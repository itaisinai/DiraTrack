import { NextResponse } from "next/server";
import { getDatabase, projects } from "@diratrack/database";
import { eq } from "drizzle-orm";
import {
  validateURLStructure,
  ALLOWED_MIME_TYPES,
  getLabelForMIME,
  safeFetch,
} from "@diratrack/document-processing";

/**
 * POST /api/projects/:slug/documents/preview
 *
 * Get metadata about a URL before downloading (HEAD request with DNS pinning)
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

    // Validate URL structure
    const urlValidation = validateURLStructure(url);
    if (!urlValidation.valid || !urlValidation.url) {
      return NextResponse.json(
        { error: urlValidation.error || "כתובת URL לא תקינה" },
        { status: 400 }
      );
    }

    // Use safe fetch with DNS pinning - try HEAD first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let fetchResult = await safeFetch({
      url,
      method: "HEAD",
      headers: {
        "User-Agent": "DiraTrack/1.0 (+https://github.com/itaisinai/DiraTrack)",
      },
      signal: controller.signal,
      maxRedirects: 5,
    });

    clearTimeout(timeout);

    // If HEAD failed, try GET with Range
    if (!fetchResult.ok || !fetchResult.response) {
      fetchResult = await safeFetch({
        url,
        method: "GET",
        headers: {
          "Range": "bytes=0-0",
          "User-Agent": "DiraTrack/1.0 (+https://github.com/itaisinai/DiraTrack)",
        },
        signal: AbortSignal.timeout(10000),
        maxRedirects: 5,
      });

      if (!fetchResult.ok || !fetchResult.response) {
        return NextResponse.json(
          { error: fetchResult.error || "לא הצלחנו לקבל מידע על הקובץ" },
          { status: 502 }
        );
      }
    }

    const response = fetchResult.response;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return NextResponse.json(
        { error: `השרת החזיר שגיאה: HTTP ${response.statusCode}` },
        { status: 502 }
      );
    }

    // Extract metadata from headers
    const contentTypeHeader = response.headers["content-type"];
    const contentType = (Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader) || "application/octet-stream";
    const mimeType = contentType.split(";")[0]?.trim() || "application/octet-stream";

    const contentLengthHeader = response.headers["content-length"];
    const contentLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
    const sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;

    const isSupported = Boolean(ALLOWED_MIME_TYPES[mimeType]);
    const mimeLabel = isSupported ? getLabelForMIME(mimeType) : null;

    return NextResponse.json({
      url: fetchResult.finalURL || url,
      mimeType,
      mimeLabel,
      sizeBytes,
      isSupported,
    });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json(
      { error: "שגיאה בקבלת מידע על הקובץ" },
      { status: 500 }
    );
  }
}
