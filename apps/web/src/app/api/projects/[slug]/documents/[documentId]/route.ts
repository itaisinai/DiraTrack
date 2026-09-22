import { getDatabase, documents, projectDocuments, projects, auditEvents } from "@diratrack/database";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

/**
 * DELETE /api/projects/:slug/documents/:documentId
 *
 * Removes a document from a project (preserves document for other projects)
 * Creates audit event and checks for dependent records before deletion
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
      .select({ id: projects.id, ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.currentSlug, slug))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get document details for audit
    const [projectDoc] = await db
      .select({
        documentId: projectDocuments.documentId,
        findingId: projectDocuments.findingId,
        verificationStatus: projectDocuments.verificationStatus,
        linkedAt: projectDocuments.linkedAt,
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

    // Get document name for audit
    const [doc] = await db
      .select({ originalName: documents.originalName })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    // Check for dependent records that would prevent deletion
    // Tasks with restrict foreign key will fail the delete
    try {
      // Execute deletion and audit in a transaction
      await db.transaction(async (tx) => {
        // Create audit event before deletion
        await tx.insert(auditEvents).values({
          projectId: project.id,
          actor: "user",
          action: "document-removed",
          entityType: "document",
          entityId: documentId,
          metadata: {
            documentName: doc?.originalName || "unknown",
            findingId: projectDoc.findingId,
            verificationStatus: projectDoc.verificationStatus,
            linkedAt: projectDoc.linkedAt?.toISOString(),
          },
        });

        // Delete the project-document link
        // Note: This will cascade to analyses (ON DELETE CASCADE)
        // and will fail if tasks reference it (ON DELETE RESTRICT)
        await tx
          .delete(projectDocuments)
          .where(
            and(
              eq(projectDocuments.projectId, project.id),
              eq(projectDocuments.documentId, documentId)
            )
          );
      });
    } catch (deleteError) {
      // Check if error is due to foreign key constraint
      if (deleteError instanceof Error && deleteError.message.includes("foreign key")) {
        return NextResponse.json(
          {
            error: "Cannot remove document: it is referenced by tasks or other records. " +
                   "Delete those records first, or keep the document in the project.",
          },
          { status: 409 }
        );
      }
      throw deleteError;
    }

    // Check if document is still referenced by other projects
    const [otherReference] = await db
      .select({ documentId: projectDocuments.documentId })
      .from(projectDocuments)
      .where(eq(projectDocuments.documentId, documentId))
      .limit(1);

    // If no other projects reference it, mark metadata as deleted
    // but keep the physical file (can be restored on re-download with same hash)
    if (!otherReference) {
      await db
        .update(documents)
        .set({
          physicalFileDeletedAt: new Date(),
          status: "file-deleted",
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
