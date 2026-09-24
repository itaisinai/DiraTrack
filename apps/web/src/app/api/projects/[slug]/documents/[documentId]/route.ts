import { getDatabase, ensureLocalUser, findProjectBySlug } from "@diratrack/database";
import { NextResponse } from "next/server";
import {
  getProjectDocument,
  deletePhysicalFile,
  removeDocumentFromProject,
} from "@diratrack/document-processing";

/**
 * DELETE /api/projects/:slug/documents/:documentId?action=remove-from-project
 * DELETE /api/projects/:slug/documents/:documentId?action=delete-file
 *
 * Two operations:
 * - remove-from-project: Unlink document from project (default)
 * - delete-file: Delete physical file while keeping metadata
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; documentId: string }> }
) {
  try {
    const { slug, documentId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "remove-from-project";

    if (action !== "remove-from-project" && action !== "delete-file") {
      return NextResponse.json(
        { error: "Invalid action. Use 'remove-from-project' or 'delete-file'" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Ensure user is authenticated
    const user = await ensureLocalUser(db);

    // Get project with owner check
    const project = await findProjectBySlug(db, user.id, slug);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify document exists in project
    const projectDoc = await getProjectDocument(db, project.project.id, documentId);
    if (!projectDoc) {
      return NextResponse.json(
        { error: "Document not found in project" },
        { status: 404 }
      );
    }

    if (action === "delete-file") {
      // Delete physical file only
      const result = await deletePhysicalFile(db, {
        projectId: project.project.id,
        documentId,
        ownerId: user.id,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to delete file" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "file-deleted",
        message: "הקובץ המקומי נמחק. המטא-דאטה והקישורים נשמרו.",
      });
    }

    // Remove from project (default)
    const result = await removeDocumentFromProject(db, {
      projectId: project.project.id,
      documentId,
      ownerId: user.id,
    });

    if (!result.success) {
      // Check for FK constraint error
      if (result.error?.includes("foreign key") || result.error?.includes("tasks")) {
        return NextResponse.json(
          {
            error: "לא ניתן להסיר מסמך שמשויך למשימות פתוחות. מחק תחילה את המשימות הקשורות.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: result.error || "Failed to remove document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "removed-from-project",
      message: "המסמך הוסר מהפרויקט",
    });
  } catch (error) {
    console.error("Document deletion error:", error);

    // Check for FK constraint error
    if (error instanceof Error && (error.message.includes("foreign key") || error.message.includes("violates"))) {
      return NextResponse.json(
        {
          error: "לא ניתן להסיר מסמך שמשויך למשימות פתוחות. מחק תחילה את המשימות הקשורות.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/:slug/documents/:documentId
 *
 * Get document metadata
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

    // Get document
    const projectDoc = await getProjectDocument(db, project.project.id, documentId);
    if (!projectDoc) {
      return NextResponse.json(
        { error: "Document not found in project" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      document: projectDoc.document,
      link: projectDoc.link,
    });
  } catch (error) {
    console.error("Document get error:", error);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 }
    );
  }
}
