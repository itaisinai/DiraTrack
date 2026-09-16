"use client";

import { useState } from "react";

interface DocumentPreview {
  url: string;
  filename: string;
  mimeType: string;
  fileTypeLabel: string;
  sizeBytes: number | null;
  sizeLabel: string;
  isAllowed: boolean;
  isSizeOk: boolean;
  canDownload: boolean;
  warnings: string[];
}

interface DocumentDownloadDialogProps {
  projectSlug: string;
  url: string;
  findingId?: string;
  onClose: () => void;
  onSuccess?: (document: any) => void;
}

export function DocumentDownloadDialog({
  projectSlug,
  url,
  findingId,
  onClose,
  onSuccess,
}: DocumentDownloadDialogProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Load preview on mount
  useState(() => {
    loadPreview();
  });

  async function loadPreview() {
    setLoadingPreview(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectSlug}/documents/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to load preview");
      }

      const result = await response.json();
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleDownload() {
    if (!preview?.canDownload) return;

    setDownloading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectSlug}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          findingId: findingId || null,
          originalName: preview.filename,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to download document");
      }

      const result = await response.json();

      if (onSuccess) {
        onSuccess(result.document);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header className="mb-6">
          <h2 id="download-dialog-title" className="text-2xl font-bold">
            הורדת מסמך
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            אשר את פרטי המסמך לפני ההורדה
          </p>
        </header>

        {loadingPreview && (
          <div className="py-8 text-center text-[var(--muted)]">
            טוען מידע על המסמך...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <strong>שגיאה:</strong> {error}
          </div>
        )}

        {preview && !loadingPreview && (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--muted)]">כתובת URL</label>
                <p className="mt-1 break-all text-sm">{preview.url}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--muted)]">שם קובץ</label>
                <p className="mt-1 font-semibold">{preview.filename}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">סוג קובץ</label>
                  <p className="mt-1">{preview.fileTypeLabel}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">גודל משוער</label>
                  <p className="mt-1">{preview.sizeLabel}</p>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <strong className="text-sm text-amber-900">אזהרות:</strong>
                  <ul className="mt-2 space-y-1">
                    {preview.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-amber-800">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!preview.canDownload && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  לא ניתן להוריד מסמך זה בגלל האזהרות למעלה.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={downloading}
                className="rounded-lg border border-[var(--border)] px-5 py-3 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleDownload}
                disabled={!preview.canDownload || downloading}
                className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {downloading ? "מוריד..." : "הורד מסמך"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
