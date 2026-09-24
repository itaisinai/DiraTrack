import { getDatabase, documents, projectDocuments, ensureLocalUser, findProjectBySlug } from "@diratrack/database";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * GET /api/projects/:slug/documents/:documentId/serve
 *
 * Serve a document file for viewing
 * Validates project access before serving
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; documentId: string }> }
) {
  try {
    const { slug, documentId } = await params;
    const db = getDatabase();

    // Ensure user is authenticated
    const user = await ensureLocalUser(db);

    // Get project with owner check
    const project = await findProjectBySlug(db, user.id, slug);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify document belongs to project
    const [projectDoc] = await db
      .select({
        documentId: projectDocuments.documentId,
      })
      .from(projectDocuments)
      .where(
        and(
          eq(projectDocuments.projectId, project.project.id),
          eq(projectDocuments.documentId, documentId)
        )
      )
      .limit(1);

    if (!projectDoc) {
      return NextResponse.json(
        { error: "Document not found in project" },
        { status: 404 }
      );
    }

    // Get document details
    const [doc] = await db
      .select({
        localPath: documents.localPath,
        originalName: documents.originalName,
        mimeType: documents.mimeType,
        status: documents.status,
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.status !== "downloaded") {
      return NextResponse.json(
        { error: "Document not downloaded yet" },
        { status: 400 }
      );
    }

    if (!doc.localPath) {
      return NextResponse.json(
        { error: "Document file path not found" },
        { status: 404 }
      );
    }

    // Read file from disk
    const filePath = path.join(process.cwd(), doc.localPath);

    try {
      const fileBuffer = await fs.readFile(filePath);

      // Determine content type
      const contentType = doc.mimeType || "application/octet-stream";

      // Return file with appropriate headers
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalName)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (fileError) {
      console.error("Failed to read document file:", fileError);
      return NextResponse.json(
        { error: "Failed to read document file" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Document serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve document" },
      { status: 500 }
    );
  }
}
