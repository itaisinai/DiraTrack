"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { encodeRouteSegment } from "@/lib/route-segment";

interface SourceCheck {
  id: string;
  status: string;
  progress: number;
  resultCount: number;
  error: string | null;
  manualAction: unknown;
  source: { key: string; name: string; category: string; baseUrl: string | null };
}

interface ResearchRunDetails {
  run: { id: string; status: string; progress: number; createdAt: string; startedAt: string | null; completedAt: string | null };
  sourceChecks: SourceCheck[];
  findings: Array<{ id: string; sourceCheckId: string; title: string; summary: string; sourceUrl: string | null; verificationStatus: string; isRelevant: boolean | null; matchingIdentifiers: unknown }>;
}

const activeStatuses = new Set(["pending", "running", "waiting-for-user"]);

function LiveResearchPage() {
  const { slug, runId } = useParams<{ slug: string; runId: string }>();
  const [details, setDetails] = useState<ResearchRunDetails | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const encodedSlug = encodeRouteSegment(slug);
  const endpoint = `/api/projects/${encodedSlug}/research-runs/${encodeURIComponent(runId)}`;

  const fetchRun = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404 ? "המחקר לא נמצא" : "לא ניתן לטעון את המחקר");
    const result = await response.json() as { researchRun: ResearchRunDetails };
    return result.researchRun;
  }, [endpoint]);

  useEffect(() => {
    void fetchRun().then(setDetails).catch((caught) => setError(caught instanceof Error ? caught.message : "לא ניתן לטעון את המחקר"));
  }, [fetchRun]);

  useEffect(() => {
    if (!details || !activeStatuses.has(details.run.status)) return;
    const interval = window.setInterval(() => void fetchRun().then(setDetails).catch(() => undefined), 2_000);
    return () => window.clearInterval(interval);
  }, [details, fetchRun]);

  const progress = useMemo(() => {
    if (!details?.sourceChecks.length) return details?.run.progress ?? 0;
    return Math.round(details.sourceChecks.reduce((sum, check) => sum + check.progress, 0) / details.sourceChecks.length);
  }, [details]);

  async function cancelRun() {
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error("לא הצלחנו לבטל את המחקר");
      setDetails(await fetchRun());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לבטל את המחקר");
    } finally {
      setCancelling(false);
    }
  }

  return <AppShell>
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href={`/projects/${encodedSlug}`} className="text-sm font-medium text-[var(--primary)]">→ חזרה לסקירת הפרויקט</Link>
        <p className="mb-2 mt-5 text-sm text-[var(--muted)]">מחקר חי</p>
        <h1 className="text-3xl font-bold">בדיקת מקורות הפרויקט</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">המערכת בודקת את המקורות שהוגדרו לפרויקט. אף פרט בפרויקט לא ישתנה אוטומטית בעקבות המחקר.</p>
      </div>
      {details && activeStatuses.has(details.run.status) && <button onClick={cancelRun} disabled={cancelling} className="rounded-lg border border-red-300 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-60">{cancelling ? "מבטל…" : "ביטול המחקר"}</button>}
    </header>

    {error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!details && !error && <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-[var(--muted)]">טוען את מצב המחקר…</div>}
    {details && <>
      <section className="rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--muted)]">מצב המחקר</p><h2 className="mt-1 text-xl font-bold">{runStatusLabel(details.run.status)}</h2></div><strong className="text-2xl text-[var(--primary)]">{progress}%</strong></div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`התקדמות ${progress}%`}><div className="h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${progress}%` }} /></div>
        <p className="mt-4 text-sm text-[var(--muted)]">{currentStep(details)}</p>
      </section>

      {details.run.status === "completed-with-errors" && <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">המחקר הסתיים חלקית. מקורות שלא ניתן לבדוק אוטומטית מסומנים בנפרד ואינם נחשבים ככאלה שלא נמצאו בהם תוצאות.</p>}
      {details.run.status === "cancelled" && <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">המחקר בוטל. מידע שכבר נשמר לא הוחל על הפרויקט.</p>}

      <section className="mt-7">
        <div className="mb-4"><h2 className="text-xl font-bold">מקורות במחקר</h2><p className="mt-1 text-sm text-[var(--muted)]">מצב הבדיקה מוצג בנפרד לכל מקור.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          {details.sourceChecks.map((check) => <SourceCard key={check.id} check={check} />)}
        </div>
      </section>

      {details.findings.length > 0 && <section className="mt-8 rounded-xl border border-[var(--border)] bg-white p-6">
        <div><h2 className="text-xl font-bold">תוצאות המחקר</h2><p className="mt-1 text-sm text-[var(--muted)]">אלו התאמות ממקורות חיים. הן אינן נחשבות לעובדות בפרויקט עד לאימות ידני.</p></div>
        <div className="mt-5 grid gap-4">
          {details.findings.map((finding) => <article key={finding.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-bold">{finding.title}</h3><FindingRunStatus isRelevant={finding.isRelevant}/></div>
            <p className="mt-3 text-sm text-[var(--muted)]">{finding.summary}</p>
            <div className="mt-4 flex flex-wrap gap-4"><Link href={`/projects/${encodedSlug}/findings/${encodeRouteSegment(finding.id)}`} className="text-sm font-semibold text-[var(--primary)]">סקירת הממצא</Link>{finding.sourceUrl && <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--primary)]">פתיחת המקור ↗</a>}</div>
          </article>)}
        </div>
      </section>}
    </>}
  </AppShell>;
}

export default LiveResearchPage;

function SourceCard({ check }: { check: SourceCheck }) {
  const manualAction = parseManualAction(check.manualAction);
  return <article className="rounded-xl border border-[var(--border)] bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{check.source.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{categoryLabel(check.source.category)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceStatusStyle(check.status)}`}>{sourceStatusLabel(check)}</span></div>
    <p className="mt-4 text-sm text-[var(--muted)]">{sourceExplanation(check)}</p>
    {check.status === "waiting-for-user" && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>{manualAction?.title ?? "נדרשת פעולה ידנית"}</strong><p className="mt-1">{manualAction?.description ?? "נדרשת פעולה ידנית לפני שניתן להמשיך בבדיקת המקור."}</p>{manualAction?.searchValue && <p className="mt-2">ערך לחיפוש: <bdi className="font-bold">{manualAction.searchValue}</bdi></p>}</div>}
    {(manualAction?.url ?? check.source.baseUrl) && <a href={manualAction?.url ?? check.source.baseUrl!} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]">פתיחת המקור ↗</a>}
  </article>;
}

function parseManualAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const action = value as Record<string, unknown>;
  if (typeof action.title !== "string" || typeof action.description !== "string" || typeof action.url !== "string") return null;
  return { title: action.title, description: action.description, url: action.url, searchValue: typeof action.searchValue === "string" ? action.searchValue : undefined };
}

function FindingRunStatus({ isRelevant }: { isRelevant: boolean | null }) {
  if (isRelevant === true) return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">רלוונטי · דורש בדיקה</span>;
  if (isRelevant === false) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">לא רלוונטי</span>;
  return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">ממתין לבדיקה · לא מאומת</span>;
}

function currentStep(details: ResearchRunDetails) {
  const running = details.sourceChecks.find((check) => check.status === "running");
  if (running) return `בודק כעת: ${running.source.name}`;
  if (details.sourceChecks.some((check) => check.status === "waiting-for-user")) return "מקור אחד או יותר ממתין לפעולה ידנית";
  if (details.run.status === "pending") return "המחקר ממתין ל־worker המקומי";
  return runStatusLabel(details.run.status);
}

function runStatusLabel(status: string) {
  return ({ pending: "ממתין להתחלה", running: "המחקר בתהליך", "waiting-for-user": "ממתין לפעולה", completed: "המחקר הושלם", "completed-with-errors": "המחקר הסתיים חלקית", failed: "המחקר נכשל", cancelled: "המחקר בוטל" } as Record<string, string>)[status] ?? status;
}

function sourceStatusLabel(check: SourceCheck) {
  if (check.status === "skipped" && check.error === "adapter-not-implemented") return "טרם נתמך אוטומטית";
  if (check.status === "skipped" && check.error === "research-cancelled") return "בוטל";
  return ({ pending: "ממתין", running: "בבדיקה", "results-found": "נמצאו תוצאות לבדיקה", "no-results": "לא נמצאו תוצאות", "waiting-for-user": "נדרשת פעולה ידנית", completed: "הושלם", failed: "נכשל", skipped: "דולג" } as Record<string, string>)[check.status] ?? check.status;
}

function sourceExplanation(check: SourceCheck) {
  if (check.status === "skipped" && check.error === "adapter-not-implemented") return "המתאם למקור זה עדיין לא מומש. לא בוצעה בדיקה ולכן אין להסיק שלא קיימות תוצאות.";
  if (check.status === "skipped" && check.error === "research-cancelled") return "בדיקת המקור נעצרה בעקבות ביטול המחקר.";
  if (check.status === "failed") return "הבדיקה נכשלה. אפשר לנסות שוב במחקר חדש.";
  if (check.status === "results-found") return `${check.resultCount} תוצאות ממתינות לבדיקה ולאימות.`;
  if (check.status === "no-results") return "הבדיקה הסתיימה ולא נמצאו תוצאות במקור זה.";
  if (check.status === "completed") return "בדיקת המקור הושלמה.";
  if (check.status === "running") return `בדיקת המקור מתבצעת כעת (${check.progress}%).`;
  if (check.status === "waiting-for-user") return "הבדיקה נעצרה זמנית עד להשלמת פעולה ידנית.";
  return "המקור ממתין לבדיקה.";
}

function categoryLabel(category: string) {
  return ({ official: "מקור רשמי", municipal: "מקור עירוני", developer: "מקור היזם", private: "מקור פרטי", "user-upload": "מסמכים שהעלה המשתמש" } as Record<string, string>)[category] ?? category;
}

function sourceStatusStyle(status: string) {
  if (["failed"].includes(status)) return "bg-red-50 text-red-700";
  if (["waiting-for-user", "skipped"].includes(status)) return "bg-amber-50 text-amber-800";
  if (["completed", "results-found", "no-results"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (status === "running") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}
