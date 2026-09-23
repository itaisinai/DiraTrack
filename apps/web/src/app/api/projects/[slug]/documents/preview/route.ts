import { NextResponse } from "next/server";
import { getDatabase, projects } from "@diratrack/database";
import { eq } from "drizzle-orm";
import {
  validateURLForFetch,
  ALLOWED_MIME_TYPES,
  getLabelForMIME,
} from "@diratrack/document-processing";

/**
 * POST /api/projects/:slug/documents/preview
 *
 * Get metadata about a URL before downloading (HEAD request)
 * Returns file type, estimated size, and URL for confirmation
 *
 * Requires project context for proper authorization
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const db = getDatabase();

    // Verify project exists (project-scoped authorization)
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Validate URL with SSRF protection
    const urlValidation = await validateURLForFetch(url);
    if (!urlValidation.valid || !urlValidation.url) {
      return NextResponse.json(
        { error: urlValidation.error || "כתובת URL לא תקינה" },
        { status: 400 }
      );
    }

    const parsedUrl = urlValidation.url;

    // Make HEAD request to get metadata
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "DiraTrack/1.0 (+https://github.com/itaisinai/DiraTrack)",
        },
      });
    } catch {
      clearTimeout(timeout);
      // If HEAD fails, try GET with range request
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Range: "bytes=0-0",
            "User-Agent": "DiraTrack/1.0 (+https://github.com/itaisinai/DiraTrack)",
          },
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        return NextResponse.json(
          { error: "לא הצלחנו לקבל מידע על הקובץ" },
          { status: 502 }
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `השרת החזיר שגיאה: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    // Extract metadata
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const mimeType = contentType.split(";")[0]?.trim() || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : null;
    const filename = parsedUrl.pathname.split("/").pop() || "document";

    // Get file type label
    const fileTypeLabel = getLabelForMIME(mimeType);

    // Format size
    let sizeLabel = "לא ידוע";
    if (sizeBytes !== null) {
      if (sizeBytes < 1024) {
        sizeLabel = `${sizeBytes} בתים`;
      } else if (sizeBytes < 1024 * 1024) {
        sizeLabel = `${(sizeBytes / 1024).toFixed(1)} KB`;
      } else {
        sizeLabel = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    }

    // Check if allowed
    const isAllowed = Boolean(ALLOWED_MIME_TYPES[mimeType]);
    const maxSize = 100 * 1024 * 1024; // 100MB
    const isSizeOk = sizeBytes === null || sizeBytes <= maxSize;

    const warnings: string[] = [];
    if (!isAllowed) {
      warnings.push(`סוג קובץ לא נתמך: ${mimeType}`);
    }
    if (!isSizeOk) {
      warnings.push("הקובץ גדול מדי (מקסימום 100MB)");
    }

    return NextResponse.json({
      url,
      filename,
      mimeType,
      fileTypeLabel,
      sizeBytes,
      sizeLabel,
      isAllowed,
      isSizeOk,
      canDownload: isAllowed && isSizeOk,
      warnings,
    });
  } catch (error) {
    console.error("Document preview error:", error);
    return NextResponse.json(
      { error: "Failed to preview document" },
      { status: 500 }
    );
  }
}
