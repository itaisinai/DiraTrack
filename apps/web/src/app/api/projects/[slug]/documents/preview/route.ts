import { NextResponse } from "next/server";

/**
 * POST /api/projects/:slug/documents/preview
 *
 * Get metadata about a URL before downloading (HEAD request)
 * Returns file type, estimated size, and URL for confirmation
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate HTTPS
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Only HTTPS URLs are allowed" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Make HEAD request to get metadata
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
    } catch {
      clearTimeout(timeout);
      // If HEAD fails, try GET with range request
      try {
        response = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to fetch file metadata" },
          { status: 502 }
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Server returned HTTP ${response.status}` },
        { status: 502 }
      );
    }

    // Extract metadata
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const mimeType = contentType.split(";")[0]?.trim() || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : null;
    const filename = parsedUrl.pathname.split("/").pop() || "document";

    // Determine file type label
    const fileTypeLabels: Record<string, string> = {
      "application/pdf": "PDF",
      "application/msword": "Word",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (DOCX)",
      "application/vnd.ms-excel": "Excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (XLSX)",
      "image/jpeg": "תמונה (JPEG)",
      "image/png": "תמונה (PNG)",
      "text/plain": "קובץ טקסט",
    };

    const fileTypeLabel = fileTypeLabels[mimeType] || mimeType;

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
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "text/plain",
    ];

    const isAllowed = allowedMimeTypes.includes(mimeType);
    const maxSize = 100 * 1024 * 1024; // 100MB
    const isSizeOk = sizeBytes === null || sizeBytes <= maxSize;

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
      warnings: [
        ...(!isAllowed ? [`סוג קובץ לא נתמך: ${mimeType}`] : []),
        ...(!isSizeOk ? ["הקובץ גדול מדי (מקסימום 100MB)"] : []),
      ],
    });
  } catch (error) {
    console.error("Document preview error:", error);
    return NextResponse.json(
      { error: "Failed to preview document" },
      { status: 500 }
    );
  }
}
