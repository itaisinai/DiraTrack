"use client";

import { useState, useMemo } from "react";

export interface SourceMetadata {
  key: string;
  name: string;
  category: "official" | "municipal" | "developer" | "user-upload";
  isEnabled: boolean;
  isImplemented: boolean;
  requiresManualAction: boolean;
  sendsExternalData: boolean;
  lastCheckedAt: string | null;
  lastResultStatus: "success" | "partial" | "failed" | "manual" | null;
}

interface SourceSelectionDialogProps {
  projectSlug: string;
  sources: SourceMetadata[];
  onStart: (selectedKeys: string[], externalDataConsent: boolean) => void;
  onClose: () => void;
  isStarting?: boolean;
}

export function SourceSelectionDialog({
  sources,
  onStart,
  onClose,
  isStarting = false,
}: SourceSelectionDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [externalDataConsent, setExternalDataConsent] = useState(false);

  // Group sources by category
  const groupedSources = useMemo(() => {
    const groups = {
      official: [] as SourceMetadata[],
      municipal: [] as SourceMetadata[],
      developer: [] as SourceMetadata[],
      "user-upload": [] as SourceMetadata[],
    };

    for (const source of sources) {
      if (source.isEnabled) {
        groups[source.category].push(source);
      }
    }

    return groups;
  }, [sources]);

  // Check if any selected source sends external data
  const requiresConsent = useMemo(() => {
    return sources.some((s) => selectedKeys.has(s.key) && s.sendsExternalData);
  }, [sources, selectedKeys]);

  // Check if start button should be disabled
  const canStart = selectedKeys.size > 0 && (!requiresConsent || externalDataConsent);

  function toggleSource(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    const allKeys = sources.filter((s) => s.isEnabled).map((s) => s.key);
    setSelectedKeys(new Set(allKeys));
  }

  function deselectAll() {
    setSelectedKeys(new Set());
  }

  function handleStart() {
    if (!canStart || isStarting) return;
    onStart([...selectedKeys], externalDataConsent);
  }

  function getCategoryLabel(category: SourceMetadata["category"]): string {
    const labels = {
      official: "מקורות רשמיים",
      municipal: "מקורות עירוניים",
      developer: "אתרי יזמים",
      "user-upload": "מסמכים של המשתמש",
    };
    return labels[category];
  }

  function getCapabilityBadge(source: SourceMetadata) {
    if (!source.isImplemented) {
      return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">לא מיושם</span>;
    }
    if (source.requiresManualAction) {
      return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">דורש פעולה ידנית</span>;
    }
    return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">אוטומטי</span>;
  }

  function getLastCheckStatus(source: SourceMetadata) {
    if (!source.lastCheckedAt) {
      return <span className="text-xs text-[var(--muted)]">טרם נבדק</span>;
    }

    const date = new Date(source.lastCheckedAt);
    const formattedDate = date.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const statusLabel = source.lastResultStatus === "success"
      ? "הצליח"
      : source.lastResultStatus === "partial"
        ? "חלקי"
        : source.lastResultStatus === "failed"
          ? "נכשל"
          : source.lastResultStatus === "manual"
            ? "ידני"
            : "";

    return (
      <span className="text-xs text-[var(--muted)]">
        נבדק לאחרונה: {formattedDate} {formattedTime}
        {statusLabel && ` (${statusLabel})`}
      </span>
    );
  }

  const enabledSourcesExist = sources.some((s) => s.isEnabled);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-selection-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <header className="mb-6">
          <h2 id="source-selection-title" className="text-2xl font-bold">
            בחירת מקורות למחקר
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            בחר את המקורות שברצונך לבדוק במסגרת המחקר. ניתן לבחור מספר מקורות במקביל.
          </p>
        </header>

        {!enabledSourcesExist && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>אין מקורות זמינים:</strong> לא ניתן להתחיל מחקר כי כל המקורות מושבתים. יש לאפשר
            לפחות מקור אחד בהגדרות הפרויקט.
          </div>
        )}

        {enabledSourcesExist && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  בחר הכל
                </button>
                <button
                  onClick={deselectAll}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  בטל בחירה
                </button>
              </div>
              <span className="text-sm text-[var(--muted)]">
                נבחרו {selectedKeys.size} מקורות
              </span>
            </div>

            <div className="space-y-6">
              {(Object.keys(groupedSources) as Array<keyof typeof groupedSources>).map((category) => {
                const categorySources = groupedSources[category];
                if (categorySources.length === 0) return null;

                return (
                  <section key={category}>
                    <h3 className="mb-3 text-sm font-bold text-[var(--muted)]">
                      {getCategoryLabel(category)}
                    </h3>
                    <div className="space-y-2">
                      {categorySources.map((source) => (
                        <label
                          key={source.key}
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            selectedKeys.has(source.key)
                              ? "border-[var(--primary)] bg-blue-50"
                              : "border-[var(--border)] hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(source.key)}
                            onChange={() => toggleSource(source.key)}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{source.name}</span>
                              {getCapabilityBadge(source)}
                              {source.sendsExternalData && (
                                <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                                  שולח נתונים החוצה
                                </span>
                              )}
                            </div>
                            {getLastCheckStatus(source)}
                          </div>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {requiresConsent && (
              <div className="mt-6 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  <strong>חשוב:</strong> אחד או יותר מהמקורות שבחרת שולחים נתונים לשרתים חיצוניים.
                  המקורות עשויים לתעד את השאילתות שלך. יש לאשר את השימוש בנתונים כדי להמשיך.
                </p>
                <label className="flex items-start gap-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={externalDataConsent}
                    onChange={(event) => setExternalDataConsent(event.target.checked)}
                    className="mt-1 flex-shrink-0"
                  />
                  <span>
                    אני מאשר/ת להשתמש בנתוני החיפוש המפורטים (שם הפרויקט, עיר, מזהים) מול המקורות
                    שבחרתי לצורך המחקר.
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-5 py-3 font-semibold hover:bg-slate-50"
          >
            ביטול
          </button>
          <button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {isStarting ? "מתחיל מחקר…" : "התחל מחקר"}
          </button>
        </div>
      </section>
    </div>
  );
}
