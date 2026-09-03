"use client";

import React from "react";
import Link from "next/link";
import { encodeRouteSegment } from "@/lib/route-segment";

interface SourceCheck {
  id: string;
  status: string;
  error: string | null;
  source: { key: string; name: string; category: string; baseUrl: string | null };
}

interface ResearchSummaryData {
  run: {
    id: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  sourceChecks: SourceCheck[];
  totalSources: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  findingsCount: number;
  findingsAwaitingReview: number;
  duration: string | null;
  hasPartialCompletion: boolean;
}

interface ResearchSummaryProps {
  projectSlug: string;
  data: ResearchSummaryData;
  onRetrySource: (sourceCheckId: string) => Promise<void>;
}

export function ResearchSummary({ projectSlug, data, onRetrySource }: ResearchSummaryProps) {
  const encodedSlug = encodeRouteSegment(projectSlug);
  const failedChecks = data.sourceChecks.filter((check) => check.status === "failed");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">סיכום המחקר</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">המחקר הסתיים</p>
          </div>
          <StatusBadge status={data.run.status} />
        </div>

        {data.hasPartialCompletion && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            המחקר הסתיים חלקית. חלק מהמקורות לא ניתנו לבדיקה אוטומטית או נכשלו.
          </div>
        )}

        {data.run.status === "cancelled" && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            המחקר בוטל. מידע שכבר נשמר לא הוחל על הפרויקט.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="סך הכל מקורות"
            value={data.totalSources}
            color="blue"
          />
          <StatCard
            label="בדיקות שהושלמו"
            value={data.completedCount}
            color="green"
          />
          <StatCard
            label="בדיקות שנכשלו"
            value={data.failedCount}
            color="red"
          />
          <StatCard
            label="מקורות שדולגו"
            value={data.skippedCount}
            color="amber"
          />
          <StatCard
            label="ממצאים שנמצאו"
            value={data.findingsCount}
            color="purple"
          />
          <StatCard
            label="ממצאים בהמתנה לבדיקה"
            value={data.findingsAwaitingReview}
            color="blue"
          />
        </div>

        <div className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6 md:grid-cols-3">
          <TimeInfo
            label="זמן התחלה"
            time={data.run.startedAt}
          />
          <TimeInfo
            label="זמן סיום"
            time={data.run.completedAt}
          />
          <TimeInfo
            label="משך המחקר"
            time={data.duration}
            isDuration
          />
        </div>
      </section>

      {failedChecks.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold">מקורות שנכשלו</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ניתן לנסות שוב לבדוק את המקורות שנכשלו
            </p>
          </div>
          <div className="space-y-3">
            {failedChecks.map((check) => (
              <FailedSourceCard
                key={check.id}
                check={check}
                onRetry={onRetrySource}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-4">
        {data.findingsCount > 0 && (
          <Link
            href={`/projects/${encodedSlug}/findings`}
            className="rounded-lg bg-[var(--primary)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--primary-dark)]"
          >
            צפייה בכל הממצאים
          </Link>
        )}
        <Link
          href={`/projects/${encodedSlug}`}
          className="rounded-lg border border-[var(--border)] bg-white px-6 py-3 font-semibold text-[var(--foreground)] transition-colors hover:bg-slate-50"
        >
          חזרה לפרויקט
        </Link>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "completed-with-errors": "bg-amber-50 text-amber-800 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  } as Record<string, string>;

  const labels = {
    completed: "הושלם בהצלחה",
    "completed-with-errors": "הושלם חלקית",
    failed: "נכשל",
    cancelled: "בוטל",
  } as Record<string, string>;

  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${styles[status] ?? styles.completed}`}>
      {labels[status] ?? status}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: "blue" | "green" | "red" | "amber" | "purple";
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colorStyles[color]}`}>{value}</p>
    </div>
  );
}

interface TimeInfoProps {
  label: string;
  time: string | null;
  isDuration?: boolean;
}

function TimeInfo({ label, time, isDuration = false }: TimeInfoProps) {
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "—";
    if (isDuration) return timeString;

    try {
      const date = new Date(timeString);
      return new Intl.DateTimeFormat("he-IL", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    } catch {
      return timeString;
    }
  };

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold">{formatTime(time)}</p>
    </div>
  );
}

interface FailedSourceCardProps {
  check: SourceCheck;
  onRetry: (sourceCheckId: string) => Promise<void>;
}

function FailedSourceCard({ check, onRetry }: FailedSourceCardProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);

  async function handleRetry() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      await onRetry(check.id);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "נכשל בניסיון חוזר");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-bold">{check.source.name}</h4>
          {check.error && (
            <p className="mt-1 text-sm text-red-700">שגיאה: {check.error}</p>
          )}
          {retryError && (
            <p className="mt-1 text-sm text-red-700">שגיאת ניסיון חוזר: {retryError}</p>
          )}
        </div>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {isRetrying ? "מנסה שוב..." : "ניסיון חוזר"}
        </button>
      </div>
    </div>
  );
}
