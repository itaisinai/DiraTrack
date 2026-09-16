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
  const encodedSlug = encodeRouteSegment(slug);

  useEffect(() => {
    loadDocuments();
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
            ניתן להוסיף מסמכים מתוצאות מחקר על ידי לחיצה על „הורדה כמסמך" בעמוד הממצא.
          </p>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
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

              {doc.remoteUrl && (
                <a
                  href={doc.remoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm font-medium text-[var(--primary)]"
                >
                  → כתובת URL מקורית
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default DocumentsPage;
