"use client";

import { StageTracker } from "@diratrack/shared-ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

interface Project { name: string; city: string; developer: string | null; currentSlug: string; operationalStatus: string; stage: "winning" | "planning" | "building-permit" | "apartment-selection-and-contract" | "construction" | "occupancy-approval" | "delivery"; }
interface Identifier { id: string; type: string; value: string; origin: string; verificationStatus: string; }
interface ResearchRun { id: string; status: string; progress: number; createdAt: string; }

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ project: Project; identifiers: Identifier[] } | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const encodedSlug = encodeURIComponent(slug);

  const loadRuns = useCallback(() => fetch(`/api/projects/${encodedSlug}/research-runs`).then((response) => response.ok ? response.json() : Promise.reject()).then((result: { researchRuns: ResearchRun[] }) => setRuns(result.researchRuns)).catch(() => undefined), [encodedSlug]);
  useEffect(() => { fetch(`/api/projects/${encodedSlug}`).then(async (response) => { if (!response.ok) throw new Error("הפרויקט לא נמצא"); return response.json(); }).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "לא ניתן לטעון את הפרויקט")); void loadRuns(); }, [encodedSlug, loadRuns]);

  async function startResearch() {
    setStarting(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodedSlug}/research-runs`, { method: "POST" });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "לא הצלחנו להתחיל את המחקר"); }
      await loadRuns();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "לא הצלחנו להתחיל את המחקר"); } finally { setStarting(false); }
  }

  return <AppShell>
    {!data && !error && <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-[var(--muted)]">טוען פרויקט…</div>}
    {error && !data && <section className="rounded-xl border border-red-200 bg-red-50 p-8"><h1 className="text-xl font-bold">{error}</h1><Link href="/" className="mt-4 inline-block font-semibold text-[var(--primary)]">חזרה ללוח הפרויקטים</Link></section>}
    {data && <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><Link href="/" className="text-sm font-medium text-[var(--primary)]">→ כל הפרויקטים</Link><p className="mb-2 mt-5 text-sm text-[var(--muted)]">{[data.project.city, data.project.developer].filter(Boolean).join(" · ")}</p><h1 className="text-3xl font-bold">{data.project.name}</h1></div><button onClick={startResearch} disabled={starting} className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white disabled:opacity-60">{starting ? "מתחיל מחקר…" : "הפעלת מחקר חדש"}</button></header>
      {error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <StageTracker currentStage={data.project.stage} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Summary title="הסטטוס הנוכחי" body={data.project.operationalStatus}/><Summary title="מה השתנה לאחרונה" body={runs[0] ? researchStatus(runs[0].status) : "טרם הופעל מחקר"}/><Summary title="מזהים שנשמרו" body={`${data.identifiers.length} מזהים`}/><Summary title="מה עדיין לא ידוע" body="תוכנית, מכרז ובקשה להיתר"/></div>
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">פרטי הפרויקט והמזהים</h2><p className="mt-1 text-sm text-[var(--muted)]">כל מזהה מוצג עם המקור ומצב האימות שלו.</p></div></div>{data.identifiers.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.identifiers.map((identifier) => <article key={identifier.id} className="rounded-lg border border-[var(--border)] p-4"><div className="flex justify-between gap-3"><strong>{identifierLabel(identifier.type)} {identifier.value}</strong><span className="text-xs text-amber-700">לא מאומת</span></div><p className="mt-2 text-xs text-[var(--muted)]">{originLabel(identifier.origin)}</p></article>)}</div> : <p className="mt-5 text-[var(--muted)]">לא נוספו מזהים לפרויקט.</p>}</section>
    </>}
  </AppShell>;
}

function Summary({ title, body }: { title: string; body: string }) { return <article className="rounded-xl border border-[var(--border)] border-r-4 border-r-slate-300 bg-white p-5"><h2 className="text-sm font-medium text-[var(--muted)]">{title}</h2><p className="mt-3 font-semibold">{body}</p></article>; }
function identifierLabel(type: string) { return ({ "lottery-number": "הגרלה", block: "גוש", parcel: "חלקה", lot: "מגרש" } as Record<string, string>)[type] ?? type; }
function originLabel(origin: string) { return ({ "winning-message": "חולץ מהודעת הזכייה", manual: "נוסף ידנית", research: "נמצא במחקר", "official-source": "מקור רשמי" } as Record<string, string>)[origin] ?? origin; }
function researchStatus(status: string) { return ({ pending: "מחקר ממתין", running: "מחקר בתהליך", "completed-with-errors": "מחקר הסתיים חלקית", completed: "מחקר הושלם", failed: "מחקר נכשל" } as Record<string, string>)[status] ?? status; }
