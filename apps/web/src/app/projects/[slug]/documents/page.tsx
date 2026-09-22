"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { encodeRouteSegment } from "@/lib/route-segment";

interface ProjectDocument {
  documentId: string;
  findingId: string | null;
  linkedAt: string;
  verificationStatus: string;
  sha256: string | null;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  remoteUrl: string | null;
  status: string;
  createdAt: string;
}

function DocumentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingDocument, setViewingDocument] = useState<ProjectDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const encodedSlug = encodeRouteSegment(slug);

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.originalName.toLowerCase().includes(query) ||
      doc.mimeType?.toLowerCase().includes(query) ||
      getFileTypeLabel(doc.mimeType).toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encodedSlug]);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${encodedSlug}/documents`);
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }

      const result = await response.json();
      setDocuments(result.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (bytes === null) return "לא ידוע";
    if (bytes < 1024) return `${bytes} בתים`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileTypeLabel(mimeType: string | null): string {
    if (!mimeType) return "לא ידוע";

    const labels: Record<string, string> = {
      "application/pdf": "PDF",
      "application/msword": "Word",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (DOCX)",
      "application/vnd.ms-excel": "Excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (XLSX)",
      "image/jpeg": "תמונה (JPEG)",
      "image/png": "תמונה (PNG)",
      "text/plain": "קובץ טקסט",
    };

    return labels[mimeType] || mimeType;
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      "remote-only": "מרוחק בלבד",
      "downloading": "מוריד...",
      "downloaded": "הורד",
      "duplicate": "כפילות",
      "file-deleted": "נמחק",
      "failed": "נכשל",
    };

    return labels[status] || status;
  }

  function getStatusColor(status: string): string {
    if (status === "downloaded") return "bg-emerald-100 text-emerald-800";
    if (status === "duplicate") return "bg-blue-100 text-blue-800";
    if (status === "downloading") return "bg-amber-100 text-amber-800";
    if (status === "failed" || status === "file-deleted") return "bg-red-100 text-red-800";
    return "bg-slate-100 text-slate-600";
  }

  async function handleDelete(doc: ProjectDocument) {
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${encodedSlug}/documents/${encodeRouteSegment(doc.documentId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete document");
      }

      setDeletingDocument(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <header className="mb-8">
        <Link href={`/projects/${encodedSlug}`} className="text-sm font-medium text-[var(--primary)]">
          → חזרה לפרויקט
        </Link>
        <h1 className="mt-4 text-3xl font-bold">ספריית המסמכים</h1>
        <p className="mt-2 text-[var(--muted)]">
          כל המסמכים שהורדו במסגרת המחקר
        </p>
        {!loading && documents.length > 0 && (
          <div className="mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם קובץ או סוג..."
              className="w-full rounded-lg border border-[var(--border)] px-4 py-2"
            />
            {searchQuery && (
              <p className="mt-2 text-sm text-[var(--muted)]">
                נמצאו {filteredDocuments.length} מתוך {documents.length} מסמכים
              </p>
            )}
          </div>
        )}
      </header>

      {loading && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center text-[var(--muted)]">
          טוען מסמכים...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <h2 className="text-xl font-bold text-red-900">שגיאה</h2>
          <p className="mt-2 text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <h2 className="text-xl font-bold text-[var(--muted)]">אין מסמכים עדיין</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ניתן להוסיף מסמכים מתוצאות מחקר על ידי לחיצה על הורדה כמסמך בעמוד הממצא.
          </p>
        </div>
      )}

      {!loading && !error && documents.length > 0 && filteredDocuments.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <h2 className="text-xl font-bold text-[var(--muted)]">לא נמצאו מסמכים</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            נסה מילות חיפוש אחרות
          </p>
        </div>
      )}

      {viewingDocument && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 p-4"
          onClick={() => setViewingDocument(null)}
        >
          <div
            className="mx-auto h-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-bold">{viewingDocument.originalName}</h2>
              <button
                onClick={() => setViewingDocument(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold hover:bg-slate-50"
              >
                סגור
              </button>
            </div>
            <iframe
              src={`/api/projects/${encodedSlug}/documents/${encodeRouteSegment(viewingDocument.documentId)}/serve`}
              className="flex-1 w-full"
              title={viewingDocument.originalName}
            />
          </div>
        </div>
      )}

      {deletingDocument && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          onClick={() => setDeletingDocument(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold">הסרת מסמך</h2>
            <p className="mt-4 text-[var(--muted)]">
              האם אתה בטוח שברצונך להסיר את המסמך <strong>{deletingDocument.originalName}</strong> מהפרויקט?
            </p>
            <p className="mt-2 text-sm text-amber-700">
              המסמך יוסר מהפרויקט הנוכחי. אם פרויקטים אחרים משתמשים בו, הקובץ יישאר במערכת.
            </p>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingDocument(null)}
                disabled={deleting}
                className="rounded-lg border border-[var(--border)] px-5 py-3 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDelete(deletingDocument)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "מוחק..." : "הסר מסמך"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && filteredDocuments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <article
              key={doc.documentId}
              className="rounded-xl border border-[var(--border)] bg-white p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 overflow-hidden">
                  <h3 className="truncate font-bold" title={doc.originalName}>
                    {doc.originalName}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {getFileTypeLabel(doc.mimeType)}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${getStatusColor(doc.status)}`}>
                      {getStatusLabel(doc.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">גודל:</span>
                  <span className="font-medium">{formatFileSize(doc.sizeBytes)}</span>
                </div>

                {doc.sha256 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Hash:</span>
                    <span className="font-mono text-xs">{doc.sha256.slice(0, 16)}...</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">הורד בתאריך:</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString("he-IL")}</span>
                </div>
              </div>

              {doc.findingId && (
                <Link
                  href={`/projects/${encodedSlug}/findings/${encodeRouteSegment(doc.findingId)}`}
                  className="mt-4 block text-sm font-medium text-[var(--primary)]"
                >
                  → הממצא המקורי
                </Link>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  {doc.status === "downloaded" && doc.mimeType === "application/pdf" && (
                    <button
                      onClick={() => setViewingDocument(doc)}
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      צפייה
                    </button>
                  )}
                  {doc.remoteUrl && (
                    <a
                      href={doc.remoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-center text-sm font-semibold hover:bg-slate-50"
                    >
                      URL מקורי
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setDeletingDocument(doc)}
                  className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  הסר מהפרויקט
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default DocumentsPage;
