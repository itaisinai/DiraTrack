"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { encodeRouteSegment } from "@/lib/route-segment";

interface MatchingIdentifier { type: string; value: string; }
interface FindingDetails {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string | null;
  verificationStatus: string;
  isRelevant: boolean | null;
  matchingIdentifiers: unknown;
  researchRunId: string;
  source: { name: string; category: string; baseUrl: string | null };
}

function FindingPage() {
  const { slug, findingId } = useParams<{ slug: string; findingId: string }>();
  const [finding, setFinding] = useState<FindingDetails | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const encodedSlug = encodeRouteSegment(slug);
  const endpoint = `/api/projects/${encodedSlug}/findings/${encodeRouteSegment(findingId)}`;

  const fetchFinding = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404 ? "הממצא לא נמצא" : "לא ניתן לטעון את הממצא");
    const result = await response.json() as { finding: FindingDetails };
    return result.finding;
  }, [endpoint]);

  useEffect(() => { void fetchFinding().then(setFinding).catch((caught) => setError(caught instanceof Error ? caught.message : "לא ניתן לטעון את הממצא")); }, [fetchFinding]);

  async function decide(decision: "relevant" | "irrelevant") {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      if (!response.ok) throw new Error("לא הצלחנו לשמור את ההחלטה");
      setFinding(await fetchFinding());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את ההחלטה");
    } finally {
      setSaving(false);
    }
  }

  const identifiers = parseMatchingIdentifiers(finding?.matchingIdentifiers);

  return <AppShell>
    {!finding && !error && <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-[var(--muted)]">טוען ממצא…</div>}
    {error && !finding && <section className="rounded-xl border border-red-200 bg-red-50 p-8"><h1 className="text-xl font-bold">{error}</h1><Link href={`/projects/${encodedSlug}`} className="mt-4 inline-block font-semibold text-[var(--primary)]">חזרה לפרויקט</Link></section>}
    {finding && <>
      <Link href={`/projects/${encodedSlug}/research/${encodeRouteSegment(finding.researchRunId)}`} className="text-sm font-medium text-[var(--primary)]">→ חזרה למחקר</Link>
      <header className="mt-6 rounded-xl border border-[var(--border)] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-[var(--muted)]">{finding.source.name} · {sourceCategoryLabel(finding.source.category)}</p><h1 className="mt-2 text-3xl font-bold">{finding.title}</h1></div><FindingStatus finding={finding}/></div>
        <p className="mt-5 max-w-3xl text-[var(--muted)]">{finding.summary}</p>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">הממצא מבוסס על תוצאת חיפוש במקור חי. התאמה בחיפוש אינה מוכיחה שהעמוד מתייחס לפרויקט, ולכן הוא לא ישנה שום פרט בפרויקט ללא בדיקה נוספת.</div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-xl border border-[var(--border)] bg-white p-6"><h2 className="text-xl font-bold">ראיות והתאמות</h2>{identifiers.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{identifiers.map((identifier) => <div key={`${identifier.type}:${identifier.value}`} className="rounded-lg border border-[var(--border)] p-4"><p className="text-xs text-[var(--muted)]">{identifierTypeLabel(identifier.type)}</p><strong className="mt-1 block">{identifier.value}</strong><span className="mt-2 block text-xs text-amber-700">התאמת חיפוש · טרם אומתה בתוכן העמוד</span></div>)}</div> : <p className="mt-4 text-[var(--muted)]">לא זוהתה התאמה למזהה קנוני. התוצאה נמצאה לפי שם הפרויקט או היישוב.</p>}{finding.sourceUrl && <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white">פתיחת המקור</a>}</section>
        <aside className="rounded-xl border border-[var(--border)] bg-white p-6"><h2 className="text-lg font-bold">החלטת המשתמש</h2><p className="mt-2 text-sm text-[var(--muted)]">סימון כרלוונטי משאיר את הממצא במצב „דורש בדיקה”; הוא אינו מאמת אותו.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 grid gap-3"><button onClick={() => decide("relevant")} disabled={saving} className="rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white disabled:opacity-50">סימון כרלוונטי</button><button onClick={() => decide("irrelevant")} disabled={saving} className="rounded-lg border border-red-300 px-4 py-3 font-semibold text-red-700 disabled:opacity-50">סימון כלא רלוונטי</button></div></aside>
      </div>
    </>}
  </AppShell>;
}

export default FindingPage;

function FindingStatus({ finding }: { finding: FindingDetails }) {
  const label = finding.isRelevant === true ? "רלוונטי · דורש בדיקה" : finding.isRelevant === false ? "לא רלוונטי" : "ממתין לבדיקה";
  const style = finding.isRelevant === true ? "bg-blue-50 text-blue-700" : finding.isRelevant === false ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

function parseMatchingIdentifiers(value: unknown): MatchingIdentifier[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MatchingIdentifier => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).type === "string" && typeof (item as Record<string, unknown>).value === "string");
}

function identifierTypeLabel(type: string) {
  return ({ "lottery-number": "הגרלה", "housing-project-number": "פרויקט דיור", block: "גוש", parcel: "חלקה", lot: "מגרש", "plan-number": "תוכנית", "tender-number": "מכרז" } as Record<string, string>)[type] ?? type;
}

function sourceCategoryLabel(category: string) {
  return ({ official: "מקור רשמי", municipal: "מקור עירוני", developer: "מקור היזם", private: "מקור פרטי", "user-upload": "מסמך משתמש" } as Record<string, string>)[category] ?? category;
}
