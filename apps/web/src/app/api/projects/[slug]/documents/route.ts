import { getDatabase, documents, projectDocuments, projects } from "@diratrack/database";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
];

/**
 * POST /api/projects/:slug/documents
 *
 * Download a document from a URL and store it locally with SHA-256 hash.
 * Handles duplicate detection by hash.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { url, findingId, originalName } = body;

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

    const db = getDatabase();

    // Verify project exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Download file with size limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: "Download timeout (60s limit)" },
          { status: 408 }
        );
      }
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Download failed with HTTP ${response.status}` },
        { status: 502 }
      );
    }

    // Validate content type
    const contentType = response.headers.get("content-type") || "";
    const mimeType = contentType.split(";")[0]?.trim() || "application/octet-stream";

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `File type not allowed: ${mimeType}` },
        { status: 415 }
      );
    }

    // Validate content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max 100MB)` },
        { status: 413 }
      );
    }

    // Download and hash
    const chunks: Uint8Array[] = [];
    const hash = crypto.createHash("sha256");
    let totalSize = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "Failed to read response body" },
        { status: 502 }
      );
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large (max 100MB)` },
          { status: 413 }
        );
      }

      chunks.push(value);
      hash.update(value);
    }

    const sha256 = hash.digest("hex");
    const fileBuffer = Buffer.concat(chunks);

    // Check for duplicate by hash
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.sha256, sha256))
      .limit(1);

    if (existingDoc) {
      // Link existing document to project
      const [existingLink] = await db
        .select()
        .from(projectDocuments)
        .where(
          and(
            eq(projectDocuments.projectId, project.id),
            eq(projectDocuments.documentId, existingDoc.id)
          )
        )
        .limit(1);

      if (existingLink) {
        return NextResponse.json({
          document: existingDoc,
          duplicate: true,
          message: "Document already exists in project",
        });
      }

      // Link to project
      await db.insert(projectDocuments).values({
        projectId: project.id,
        documentId: existingDoc.id,
        findingId: findingId || null,
      });

      return NextResponse.json({
        document: existingDoc,
        duplicate: true,
        message: "Document already exists, linked to project",
      });
    }

    // Determine filename
    const filename = originalName || parsedUrl.pathname.split("/").pop() || `document-${Date.now()}`;
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const extension = path.extname(sanitizedFilename) || ".bin";
    const baseFilename = path.basename(sanitizedFilename, extension);
    const finalFilename = `${sha256.slice(0, 16)}-${baseFilename}${extension}`;

    // Ensure data/documents directory exists
    const documentsDir = path.join(process.cwd(), "data", "documents");
    await fs.mkdir(documentsDir, { recursive: true });

    // Write file
    const localPath = path.join(documentsDir, finalFilename);
    await fs.writeFile(localPath, fileBuffer);

    // Store in database
    const [newDoc] = await db
      .insert(documents)
      .values({
        sha256,
        originalName: filename,
        mimeType,
        sizeBytes: totalSize,
        remoteUrl: url,
        localPath: `data/documents/${finalFilename}`,
        status: "downloaded",
      })
      .returning();

    if (!newDoc) {
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Link to project
    await db.insert(projectDocuments).values({
      projectId: project.id,
      documentId: newDoc.id,
      findingId: findingId || null,
    });

    return NextResponse.json({
      document: newDoc,
      duplicate: false,
      message: "Document downloaded successfully",
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/:slug/documents
 *
 * List all documents for a project
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = getDatabase();

    // Get project
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get documents
    const projectDocs = await db
      .select({
        documentId: projectDocuments.documentId,
        findingId: projectDocuments.findingId,
        linkedAt: projectDocuments.linkedAt,
        verificationStatus: projectDocuments.verificationStatus,
        sha256: documents.sha256,
        originalName: documents.originalName,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        remoteUrl: documents.remoteUrl,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(projectDocuments)
      .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
      .where(eq(projectDocuments.projectId, project.id));

    return NextResponse.json({ documents: projectDocs });
  } catch (error) {
    console.error("Document listing error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}
