import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { documents, projectDocuments, auditEvents, projects, getDatabase } from "@diratrack/database";
import { eq, and } from "drizzle-orm";

type Database = ReturnType<typeof getDatabase>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseOrTransaction = Database | any;
import { downloadFileSecurely, moveToFinalDestination, cleanupTempFile } from "./streaming-downloader.js";
import { sanitizeFilename, getLabelForMIME } from "./file-validation.js";

/**
 * Document Service: Project-scoped document operations
 *
 * All operations respect project isolation and create audit events.
 * Physical file operations are separated from metadata operations.
 */

export interface DocumentMetadata {
  id: string;
  sha256: string | null;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  remoteUrl: string | null;
  localPath: string | null;
  status: string;
  physicalFileDeletedAt: Date | null;
  createdAt: Date;
}

export interface ProjectDocumentLink {
  projectId: string;
  documentId: string;
  findingId: string | null;
  verificationStatus: string;
  linkedAt: Date;
}

export interface DownloadDocumentOptions {
  projectId: string;
  remoteUrl: string;
  findingId?: string | null;
  originalFilename?: string;
  ownerId: string;
}

export interface DownloadDocumentResult {
  success: boolean;
  error?: string;
  document?: DocumentMetadata;
  isExistingDocument?: boolean;
  wasFileRestored?: boolean;
}

export interface UploadDocumentOptions {
  projectId: string;
  fileBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
  findingId?: string | null;
  ownerId: string;
}

export interface DeleteFileOptions {
  projectId: string;
  documentId: string;
  ownerId: string;
}

export interface RemoveFromProjectOptions {
  projectId: string;
  documentId: string;
  ownerId: string;
}

/**
 * Get project-scoped document with link information
 */
export async function getProjectDocument(
  db: DatabaseOrTransaction,
  projectId: string,
  documentId: string
): Promise<{ document: DocumentMetadata; link: ProjectDocumentLink } | null> {
  const results = await db
    .select({
      documentId: documents.id,
      sha256: documents.sha256,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      remoteUrl: documents.remoteUrl,
      localPath: documents.localPath,
      status: documents.status,
      physicalFileDeletedAt: documents.physicalFileDeletedAt,
      createdAt: documents.createdAt,
      linkProjectId: projectDocuments.projectId,
      linkFindingId: projectDocuments.findingId,
      linkVerificationStatus: projectDocuments.verificationStatus,
      linkLinkedAt: projectDocuments.linkedAt,
    })
    .from(projectDocuments)
    .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.documentId, documentId)
      )
    )
    .limit(1);

  if (results.length === 0) return null;

  const row = results[0]!;

  return {
    document: {
      id: row.documentId,
      sha256: row.sha256,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      remoteUrl: row.remoteUrl,
      localPath: row.localPath,
      status: row.status,
      physicalFileDeletedAt: row.physicalFileDeletedAt,
      createdAt: row.createdAt,
    },
    link: {
      projectId: row.linkProjectId,
      documentId: row.documentId,
      findingId: row.linkFindingId,
      verificationStatus: row.linkVerificationStatus,
      linkedAt: row.linkLinkedAt,
    },
  };
}

/**
 * List all documents for a project
 */
export async function listProjectDocuments(
  db: Database,
  projectId: string
): Promise<Array<DocumentMetadata & { findingId: string | null; linkedAt: Date }>> {
  const results = await db
    .select({
      documentId: documents.id,
      sha256: documents.sha256,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      remoteUrl: documents.remoteUrl,
      localPath: documents.localPath,
      status: documents.status,
      physicalFileDeletedAt: documents.physicalFileDeletedAt,
      createdAt: documents.createdAt,
      findingId: projectDocuments.findingId,
      linkedAt: projectDocuments.linkedAt,
    })
    .from(projectDocuments)
    .innerJoin(documents, eq(projectDocuments.documentId, documents.id))
    .where(eq(projectDocuments.projectId, projectId));

  return results.map((row) => ({
    id: row.documentId,
    sha256: row.sha256,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    remoteUrl: row.remoteUrl,
    localPath: row.localPath,
    status: row.status,
    physicalFileDeletedAt: row.physicalFileDeletedAt,
    createdAt: row.createdAt,
    findingId: row.findingId,
    linkedAt: row.linkedAt,
  }));
}

/**
 * Download remote document securely and link to project
 */
export async function downloadDocument(
  db: Database,
  options: DownloadDocumentOptions
): Promise<DownloadDocumentResult> {
  const { projectId, remoteUrl, findingId, originalFilename, ownerId } = options;

  try {
    // 1. Download file to temporary location with security validation
    const downloadResult = await downloadFileSecurely({
      url: remoteUrl,
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      maxRedirects: 5,
      timeoutMs: 60000,
    });

    if (!downloadResult.success || !downloadResult.tempPath || !downloadResult.sha256) {
      return {
        success: false,
        error: downloadResult.error || "הורדה נכשלה",
      };
    }

    const { tempPath, sha256, sizeBytes, actualMIME } = downloadResult;

    // 2. Check for existing document by hash
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.sha256, sha256))
      .limit(1);

    if (existingDoc) {
      // Document exists - check if already linked to this project
      const [existingLink] = await db
        .select()
        .from(projectDocuments)
        .where(
          and(
            eq(projectDocuments.projectId, projectId),
            eq(projectDocuments.documentId, existingDoc.id)
          )
        )
        .limit(1);

      // Cleanup temp file
      await cleanupTempFile(tempPath);

      if (existingLink) {
        // Already linked to this project
        return {
          success: true,
          document: existingDoc as unknown as DocumentMetadata,
          isExistingDocument: true,
        };
      }

      // Link existing document to project (cross-project reuse)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.transaction(async (tx: any) => {
        await tx.insert(projectDocuments).values({
          projectId,
          documentId: existingDoc.id,
          findingId: findingId || null,
        });

        await tx.insert(auditEvents).values({
          projectId,
          actor: "user",
          action: "document-linked",
          entityType: "document",
          entityId: existingDoc.id,
          metadata: {
            documentName: existingDoc.originalName,
            findingId,
            sha256: existingDoc.sha256,
            source: "existing-hash",
          },
        });

        // If file was marked as deleted, restore it
        if (existingDoc.status === "file-deleted" && existingDoc.localPath) {
          await tx
            .update(documents)
            .set({
              status: "downloaded",
              physicalFileDeletedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(documents.id, existingDoc.id));
        }
      });

      return {
        success: true,
        document: existingDoc as unknown as DocumentMetadata,
        isExistingDocument: true,
        wasFileRestored: existingDoc.status === "file-deleted",
      };
    }

    // 3. New document - prepare final storage path
    const sanitizedResult = sanitizeFilename(
      originalFilename || path.basename(new URL(remoteUrl).pathname) || `document-${Date.now()}`
    );

    if (!sanitizedResult.valid || !sanitizedResult.sanitizedFilename) {
      await cleanupTempFile(tempPath);
      return {
        success: false,
        error: sanitizedResult.error || "שם קובץ לא תקין",
      };
    }

    const ext = path.extname(sanitizedResult.sanitizedFilename);
    const baseName = path.basename(sanitizedResult.sanitizedFilename, ext);
    const finalFilename = `${sha256.slice(0, 16)}-${baseName}${ext}`;
    const documentsDir = path.join(process.cwd(), "data", "documents");
    const finalPath = path.join(documentsDir, finalFilename);

    // 4. Move to final destination
    const moveResult = await moveToFinalDestination(tempPath, finalPath);
    if (!moveResult.success) {
      await cleanupTempFile(tempPath);
      return {
        success: false,
        error: moveResult.error || "שגיאה בשמירת הקובץ",
      };
    }

    // 5. Create database records in transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.transaction(async (tx: any) => {
      const [newDoc] = await tx
        .insert(documents)
        .values({
          sha256,
          originalName: sanitizedResult.sanitizedFilename!,
          mimeType: actualMIME || null,
          sizeBytes: sizeBytes || null,
          remoteUrl,
          localPath: `data/documents/${finalFilename}`,
          status: "downloaded",
        })
        .returning();

      if (!newDoc) {
        throw new Error("Failed to create document record");
      }

      await tx.insert(projectDocuments).values({
        projectId,
        documentId: newDoc.id,
        findingId: findingId || null,
      });

      await tx.insert(auditEvents).values({
        projectId,
        actor: "user",
        action: "document-downloaded",
        entityType: "document",
        entityId: newDoc.id,
        metadata: {
          documentName: newDoc.originalName,
          remoteUrl,
          findingId,
          sha256,
          sizeBytes,
          mimeType: actualMIME,
        },
      });

      return newDoc;
    });

    return {
      success: true,
      document: result as unknown as DocumentMetadata,
      isExistingDocument: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בהורדת המסמך",
    };
  }
}

/**
 * Upload local file and link to project
 */
export async function uploadDocument(
  db: Database,
  options: UploadDocumentOptions
): Promise<DownloadDocumentResult> {
  const { projectId, fileBuffer, originalFilename, mimeType, findingId, ownerId } = options;

  try {
    // 1. Calculate hash
    const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const sizeBytes = fileBuffer.length;

    // Size limit check
    if (sizeBytes > 100 * 1024 * 1024) {
      return {
        success: false,
        error: "הקובץ גדול מדי (מקסימום 100MB)",
      };
    }

    // 2. Check for existing document by hash
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.sha256, sha256))
      .limit(1);

    if (existingDoc) {
      // Document exists - link to project if not already linked
      const [existingLink] = await db
        .select()
        .from(projectDocuments)
        .where(
          and(
            eq(projectDocuments.projectId, projectId),
            eq(projectDocuments.documentId, existingDoc.id)
          )
        )
        .limit(1);

      if (existingLink) {
        return {
          success: true,
          document: existingDoc as unknown as DocumentMetadata,
          isExistingDocument: true,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.transaction(async (tx: any) => {
        await tx.insert(projectDocuments).values({
          projectId,
          documentId: existingDoc.id,
          findingId: findingId || null,
        });

        await tx.insert(auditEvents).values({
          projectId,
          actor: "user",
          action: "document-uploaded",
          entityType: "document",
          entityId: existingDoc.id,
          metadata: {
            documentName: existingDoc.originalName,
            findingId,
            sha256,
            source: "user-upload-duplicate",
          },
        });

        // Restore if deleted
        if (existingDoc.status === "file-deleted") {
          await tx
            .update(documents)
            .set({
              status: "downloaded",
              physicalFileDeletedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(documents.id, existingDoc.id));
        }
      });

      return {
        success: true,
        document: existingDoc as unknown as DocumentMetadata,
        isExistingDocument: true,
        wasFileRestored: existingDoc.status === "file-deleted",
      };
    }

    // 3. New document - sanitize filename
    const sanitizedResult = sanitizeFilename(originalFilename);
    if (!sanitizedResult.valid || !sanitizedResult.sanitizedFilename) {
      return {
        success: false,
        error: sanitizedResult.error || "שם קובץ לא תקין",
      };
    }

    const ext = path.extname(sanitizedResult.sanitizedFilename);
    const baseName = path.basename(sanitizedResult.sanitizedFilename, ext);
    const finalFilename = `${sha256.slice(0, 16)}-${baseName}${ext}`;

    // 4. Write file
    const documentsDir = path.join(process.cwd(), "data", "documents");
    await fs.mkdir(documentsDir, { recursive: true });
    const finalPath = path.join(documentsDir, finalFilename);
    await fs.writeFile(finalPath, fileBuffer);

    // 5. Create database records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.transaction(async (tx: any) => {
      const [newDoc] = await tx
        .insert(documents)
        .values({
          sha256,
          originalName: sanitizedResult.sanitizedFilename!,
          mimeType,
          sizeBytes,
          remoteUrl: null,
          localPath: `data/documents/${finalFilename}`,
          status: "downloaded",
        })
        .returning();

      if (!newDoc) {
        throw new Error("Failed to create document record");
      }

      await tx.insert(projectDocuments).values({
        projectId,
        documentId: newDoc.id,
        findingId: findingId || null,
      });

      await tx.insert(auditEvents).values({
        projectId,
        actor: "user",
        action: "document-uploaded",
        entityType: "document",
        entityId: newDoc.id,
        metadata: {
          documentName: newDoc.originalName,
          findingId,
          sha256,
          sizeBytes,
          mimeType,
          source: "user-upload",
        },
      });

      return newDoc;
    });

    return {
      success: true,
      document: result as unknown as DocumentMetadata,
      isExistingDocument: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בהעלאת המסמך",
    };
  }
}

/**
 * Delete physical file while preserving metadata
 */
export async function deletePhysicalFile(
  db: Database,
  options: DeleteFileOptions
): Promise<{ success: boolean; error?: string }> {
  const { projectId, documentId, ownerId } = options;

  try {
    return await db.transaction(async (tx) => {
      // Get document
      const projectDoc = await getProjectDocument(tx, projectId, documentId);
      if (!projectDoc) {
        return {
          success: false,
          error: "המסמך לא נמצא בפרויקט",
        };
      }

      const { document } = projectDoc;

      if (document.status === "file-deleted") {
        return {
          success: false,
          error: "הקובץ כבר נמחק",
        };
      }

      if (!document.localPath) {
        return {
          success: false,
          error: "אין קובץ מקומי למחיקה",
        };
      }

      // Delete physical file
      const fullPath = path.join(process.cwd(), document.localPath);
      try {
        await fs.unlink(fullPath);
      } catch (fsError) {
        // File may not exist - continue anyway
        console.warn(`Failed to delete file ${fullPath}:`, fsError);
      }

      // Update status
      await tx
        .update(documents)
        .set({
          status: "file-deleted",
          physicalFileDeletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      // Audit event
      await tx.insert(auditEvents).values({
        projectId,
        actor: "user",
        action: "document-file-deleted",
        entityType: "document",
        entityId: documentId,
        metadata: {
          documentName: document.originalName,
          localPath: document.localPath,
        },
      });

      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה במחיקת הקובץ",
    };
  }
}

/**
 * Remove document from project (unlink)
 */
export async function removeDocumentFromProject(
  db: Database,
  options: RemoveFromProjectOptions
): Promise<{ success: boolean; error?: string }> {
  const { projectId, documentId, ownerId } = options;

  try {
    return await db.transaction(async (tx) => {
      // Get document for audit
      const projectDoc = await getProjectDocument(tx, projectId, documentId);
      if (!projectDoc) {
        return {
          success: false,
          error: "המסמך לא נמצא בפרויקט",
        };
      }

      // Audit event before deletion
      await tx.insert(auditEvents).values({
        projectId,
        actor: "user",
        action: "document-removed-from-project",
        entityType: "document",
        entityId: documentId,
        metadata: {
          documentName: projectDoc.document.originalName,
          findingId: projectDoc.link.findingId,
        },
      });

      // Delete project link (will fail if tasks reference it)
      await tx
        .delete(projectDocuments)
        .where(
          and(
            eq(projectDocuments.projectId, projectId),
            eq(projectDocuments.documentId, documentId)
          )
        );

      // Check if document is still referenced by other projects
      const [otherReference] = await tx
        .select()
        .from(projectDocuments)
        .where(eq(projectDocuments.documentId, documentId))
        .limit(1);

      // If no other projects use it, mark as file-deleted
      if (!otherReference && projectDoc.document.status !== "file-deleted") {
        await tx
          .update(documents)
          .set({
            status: "file-deleted",
            physicalFileDeletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(documents.id, documentId));

        // Also delete physical file
        if (projectDoc.document.localPath) {
          const fullPath = path.join(process.cwd(), projectDoc.document.localPath);
          await fs.unlink(fullPath).catch(() => {});
        }
      }

      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בהסרת המסמך",
    };
  }
}
