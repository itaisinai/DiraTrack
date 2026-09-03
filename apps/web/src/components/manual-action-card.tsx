"use client";

import { useState } from "react";

interface ManualAction {
  title: string;
  description: string;
  url: string;
  searchValue?: string;
}

interface ManualActionCardProps {
  sourceCheckId: string;
  sourceName: string;
  manualAction: ManualAction;
  projectSlug: string;
  runId: string;
  onActionComplete: () => void;
}

export function ManualActionCard({
  sourceCheckId,
  sourceName,
  manualAction,
  projectSlug,
  runId,
  onActionComplete,
}: ManualActionCardProps) {
  const [showCandidateDialog, setShowCandidateDialog] = useState(false);
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleNoResult() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${encodeURIComponent(runId)}/source-checks/${encodeURIComponent(sourceCheckId)}/no-result`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "לא הצלחנו לסמן 'אין תוצאה'");
      }

      onActionComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לסמן 'אין תוצאה'");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-amber-900">{sourceName}</h3>
            <p className="mt-1 text-sm font-semibold text-amber-800">{manualAction.title}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            נדרשת פעולה ידנית
          </span>
        </div>

        <p className="text-sm text-amber-900">{manualAction.description}</p>

        {manualAction.searchValue && (
          <p className="mt-2 text-sm text-amber-900">
            ערך לחיפוש: <bdi className="font-bold">{manualAction.searchValue}</bdi>
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={manualAction.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            פתיחת המקור הרשמי ↗
          </a>
          <button
            onClick={handleNoResult}
            disabled={isSubmitting}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {isSubmitting ? "שומר..." : "סימון כהושלם - ללא תוצאה"}
          </button>
          <button
            onClick={() => setShowCandidateDialog(true)}
            disabled={isSubmitting}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            הוספת כתובת מועמד
          </button>
          <button
            onClick={() => setShowDismissDialog(true)}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            דחיית מקור זה
          </button>
        </div>
      </div>

      {showCandidateDialog && (
        <AddCandidateUrlDialog
          sourceCheckId={sourceCheckId}
          sourceName={sourceName}
          projectSlug={projectSlug}
          runId={runId}
          onClose={() => setShowCandidateDialog(false)}
          onSuccess={() => {
            setShowCandidateDialog(false);
            onActionComplete();
          }}
        />
      )}

      {showDismissDialog && (
        <DismissConfirmationDialog
          sourceCheckId={sourceCheckId}
          sourceName={sourceName}
          projectSlug={projectSlug}
          runId={runId}
          onClose={() => setShowDismissDialog(false)}
          onSuccess={() => {
            setShowDismissDialog(false);
            onActionComplete();
          }}
        />
      )}
    </>
  );
}

interface AddCandidateUrlDialogProps {
  sourceCheckId: string;
  sourceName: string;
  projectSlug: string;
  runId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddCandidateUrlDialog({
  sourceCheckId,
  sourceName,
  projectSlug,
  runId,
  onClose,
  onSuccess,
}: AddCandidateUrlDialogProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  function validateUrl(value: string): string {
    if (!value.trim()) {
      return "כתובת URL היא שדה חובה";
    }

    if (!value.startsWith("https://")) {
      return "כתובת URL חייבת להתחיל ב־https://";
    }

    // Additional validation for dangerous schemes
    const dangerousSchemes = ["javascript:", "data:", "file:", "vbscript:"];
    if (dangerousSchemes.some((scheme) => value.toLowerCase().startsWith(scheme))) {
      return "כתובת URL לא תקינה";
    }

    try {
      new URL(value);
      return "";
    } catch {
      return "כתובת URL לא תקינה";
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setValidationError(validateUrl(value));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const urlValidation = validateUrl(url);
    if (urlValidation) {
      setValidationError(urlValidation);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${encodeURIComponent(runId)}/source-checks/${encodeURIComponent(sourceCheckId)}/candidate-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            title: title.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "לא הצלחנו להוסיף את כתובת המועמד");
      }

      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו להוסיף את כתובת המועמד");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = url.trim() && !validationError && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-candidate-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header className="mb-5">
          <h2 id="add-candidate-title" className="text-xl font-bold">
            הוספת כתובת מועמד
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            מקור: <span className="font-semibold">{sourceName}</span>
          </p>
        </header>

        <div className="space-y-4">
          <div>
            <label htmlFor="candidate-url" className="block text-sm font-semibold text-slate-700">
              כתובת URL <span className="text-red-600">*</span>
            </label>
            <input
              id="candidate-url"
              type="text"
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="https://example.com/page"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
              required
            />
            {validationError && (
              <p className="mt-1 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          <div>
            <label htmlFor="candidate-title" className="block text-sm font-semibold text-slate-700">
              כותרת (אופציונלי)
            </label>
            <input
              id="candidate-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="כותרת תיאורית לדף"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="candidate-notes" className="block text-sm font-semibold text-slate-700">
              הערות (אופציונלי)
            </label>
            <textarea
              id="candidate-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="הערות נוספות על הממצא"
              disabled={isSubmitting}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "שומר..." : "הוספה"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface DismissConfirmationDialogProps {
  sourceCheckId: string;
  sourceName: string;
  projectSlug: string;
  runId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function DismissConfirmationDialog({
  sourceCheckId,
  sourceName,
  projectSlug,
  runId,
  onClose,
  onSuccess,
}: DismissConfirmationDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!reason.trim()) {
      setError("נדרשת סיבה לדחיית המקור");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${encodeURIComponent(runId)}/source-checks/${encodeURIComponent(sourceCheckId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "לא הצלחנו לדחות את המקור");
      }

      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לדחות את המקור");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = reason.trim() && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dismiss-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header className="mb-5">
          <h2 id="dismiss-title" className="text-xl font-bold">
            דחיית מקור
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            מקור: <span className="font-semibold">{sourceName}</span>
          </p>
        </header>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>שים לב:</strong> דחיית המקור תסמן אותו כ&apos;דולג&apos; ולא תמשיך בבדיקתו. המקור לא ייחשב
          כמקור שלא נמצאו בו תוצאות.
        </div>

        <div>
          <label htmlFor="dismiss-reason" className="block text-sm font-semibold text-slate-700">
            סיבה לדחייה <span className="text-red-600">*</span>
          </label>
          <textarea
            id="dismiss-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="למשל: המקור אינו רלוונטי, או המידע אינו זמין"
            disabled={isSubmitting}
            rows={4}
            required
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "שומר..." : "אישור דחייה"}
          </button>
        </div>
      </form>
    </div>
  );
}
