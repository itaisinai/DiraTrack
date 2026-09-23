import { getDatabase, projects } from "@diratrack/database";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  listProjectDocuments,
  downloadDocument,
  uploadDocument,
  validateURLForFetch,
  ALLOWED_MIME_TYPES,
  validateFileContent,
} from "@diratrack/document-processing";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * POST /api/projects/:slug/documents
 *
 * Download or create remote-only document candidate
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { url, findingId, originalName, downloadFile = true } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const db = getDatabase();

    // Get project
    const [project] = await db
      .select({ id: projects.id, ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Validate URL (SSRF protection)
    const urlValidation = await validateURLForFetch(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error || "Invalid URL" },
        { status: 400 }
      );
    }

    if (!downloadFile) {
      // Create remote-only candidate (not implemented in this phase - requires document candidate table)
      return NextResponse.json(
        { error: "Remote-only documents not yet implemented" },
        { status: 501 }
      );
    }

    // Download file
    const result = await downloadDocument(db, {
      projectId: project.id,
      remoteUrl: url,
      findingId: findingId || null,
      originalFilename: originalName,
      ownerId: project.ownerId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to download document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document: result.document,
      duplicate: result.isExistingDocument || false,
      restored: result.wasFileRestored || false,
      message: result.isExistingDocument
        ? "Document already exists, linked to project"
        : "Document downloaded successfully",
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
 * PUT /api/projects/:slug/documents
 *
 * Upload local file
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get project
    const [project] = await db
      .select({ id: projects.id, ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const findingId = (formData.get("findingId") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)} MB)` },
        { status: 413 }
      );
    }

    // Validate MIME type
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return NextResponse.json(
        { error: `File type not allowed: ${mimeType}` },
        { status: 415 }
      );
    }

    // Read file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file content (magic bytes)
    const contentValidation = validateFileContent(mimeType, buffer);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error || "Invalid file content" },
        { status: 415 }
      );
    }

    // Upload file
    const result = await uploadDocument(db, {
      projectId: project.id,
      fileBuffer: buffer,
      originalFilename: file.name,
      mimeType,
      findingId,
      ownerId: project.ownerId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to upload document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document: result.document,
      duplicate: result.isExistingDocument || false,
      restored: result.wasFileRestored || false,
      message: result.isExistingDocument
        ? "Document already exists, linked to project"
        : "Document uploaded successfully",
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
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
    const docs = await listProjectDocuments(db, project.id);

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("Document listing error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}
