import { getDatabase, documents, projectDocuments, projects } from "@diratrack/database";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

/**
 * DELETE /api/projects/:slug/documents/:documentId
 *
 * Soft delete a document (marks as deleted, preserves metadata)
 * Only unlinks from the specific project, doesn't delete the physical file
 * if other projects reference it
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; documentId: string }> }
) {
  try {
    const { slug, documentId } = await params;
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

    // Verify document belongs to project
    const [projectDoc] = await db
      .select({
        documentId: projectDocuments.documentId,
      })
      .from(projectDocuments)
      .where(
        and(
          eq(projectDocuments.projectId, project.id),
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

    // Delete the project-document link
    await db
      .delete(projectDocuments)
      .where(
        and(
          eq(projectDocuments.projectId, project.id),
          eq(projectDocuments.documentId, documentId)
        )
      );

    // Check if document is still referenced by other projects
    const [otherReference] = await db
      .select({ documentId: projectDocuments.documentId })
      .from(projectDocuments)
      .where(eq(projectDocuments.documentId, documentId))
      .limit(1);

    // If no other projects reference it, mark as deleted
    if (!otherReference) {
      await db
        .update(documents)
        .set({
          physicalFileDeletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    }

    return NextResponse.json({
      success: true,
      message: "Document removed from project",
    });
  } catch (error) {
    console.error("Document deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
