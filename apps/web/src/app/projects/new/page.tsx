"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { AppShell } from "@/components/app-shell";

type Step = "message" | "details" | "review";
interface FormState { message: string; name: string; city: string; developer: string; lottery: string; block: string; parcels: string; lot: string; }
const initialForm: FormState = { message: "", name: "", city: "", developer: "", lottery: "", block: "", parcels: "", lot: "" };

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("message");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function continueFromMessage() {
    const lottery = form.message.match(/(?:הגרלה|מספר\s+הגרלה)\D{0,20}(\d{3,})/)?.[1];
    if (lottery && !form.lottery) update("lottery", lottery);
    setStep("details");
  }
  function review(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.city.trim()) { setError("שם הפרויקט והעיר הם שדות חובה."); return; }
    setError(""); setStep("review");
  }
  async function create() {
    setSaving(true); setError("");
    const identifiers = [
      form.lottery && { type: "lottery-number", value: form.lottery, origin: form.message ? "winning-message" : "manual" },
      form.block && { type: "block", value: form.block, origin: "manual" },
      ...form.parcels.split(/[,،]/).map((value) => value.trim()).filter(Boolean).map((value) => ({ type: "parcel", value, origin: "manual" })),
      form.lot && { type: "lot", value: form.lot, origin: "manual" },
    ].filter(Boolean);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, city: form.city, developer: form.developer || undefined, identifiers }) });
      const result = await response.json() as { project?: { currentSlug: string }; error?: string };
      if (!response.ok || !result.project) throw new Error(result.error || "לא הצלחנו ליצור את הפרויקט.");
      router.push(`/projects/${encodeURIComponent(result.project.currentSlug)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "לא הצלחנו ליצור את הפרויקט."); setSaving(false); }
  }

  return <AppShell>
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm font-medium text-[var(--primary)]">→ חזרה ללוח הפרויקטים</Link>
      <header className="mt-6"><p className="text-sm font-medium text-[var(--primary)]">יצירת פרויקט</p><h1 className="mt-2 text-3xl font-bold">הוספת פרויקט חדש</h1><p className="mt-2 text-[var(--muted)]">המידע נשמר רק לאחר סקירה ואישור שלך.</p></header>
      <ol className="my-8 grid grid-cols-3 gap-2" aria-label="שלבי יצירת פרויקט">{[["message", "ייבוא הודעה"], ["details", "אימות פרטים"], ["review", "סקירה"]].map(([key, label], index) => <li key={key} className={`rounded-lg border px-3 py-3 text-center text-sm ${step === key ? "border-blue-300 bg-blue-50 font-semibold text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--muted)]"}`}>{index + 1}. {label}</li>)}</ol>

      {step === "message" && <section className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">ייבוא הודעת הזכייה</h2><p className="mt-2 text-sm text-[var(--muted)]">אפשר להדביק את תוכן ההודעה כדי לחלץ את מספר ההגרלה. שום פרט לא נשמר בשלב הזה.</p><label className="mt-6 block text-sm font-semibold" htmlFor="message">תוכן ההודעה — לא חובה</label><textarea id="message" rows={9} value={form.message} onChange={(event) => update("message", event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] p-4 outline-none focus:border-blue-400" placeholder="הדבקת הודעת הזכייה כאן…"/><div className="mt-6 flex justify-end"><button onClick={continueFromMessage} className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white">המשך לאימות פרטים</button></div></section>}

      {step === "details" && <form onSubmit={review} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">אימות והשלמת פרטים</h2><p className="mt-2 text-sm text-[var(--muted)]">בדוק כל ערך. גוש, חלקות ומגרש תמיד נחשבים מידע שהוזן ידנית.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="שם הפרויקט" value={form.name} onChange={(value) => update("name", value)} required/><Field label="עיר" value={form.city} onChange={(value) => update("city", value)} required/><Field label="יזם" value={form.developer} onChange={(value) => update("developer", value)}/><Field label="מספר הגרלה" value={form.lottery} onChange={(value) => update("lottery", value)}/><Field label="גוש" value={form.block} onChange={(value) => update("block", value)}/><Field label="חלקות" hint="הפרדה בפסיקים" value={form.parcels} onChange={(value) => update("parcels", value)}/><Field label="מגרש" value={form.lot} onChange={(value) => update("lot", value)}/></div>{error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-8 flex justify-between gap-3"><button type="button" onClick={() => setStep("message")} className="rounded-lg border border-[var(--border)] px-5 py-3 font-semibold">חזרה</button><button className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white">מעבר לסקירה</button></div></form>}

      {step === "review" && <section className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">סקירת הפרויקט</h2><p className="mt-2 text-sm text-[var(--muted)]">רק לאחר האישור הפרויקט ייווצר.</p><dl className="mt-6 divide-y divide-[var(--border)]">{[["שם", form.name], ["עיר", form.city], ["יזם", form.developer || "חסר"], ["הגרלה", form.lottery || "חסר"], ["גוש", form.block || "חסר"], ["חלקות", form.parcels || "חסר"], ["מגרש", form.lot || "חסר"]].map(([label, value]) => <div key={label} className="grid grid-cols-[7rem_1fr] gap-4 py-3"><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>{error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-8 flex justify-between gap-3"><button onClick={() => setStep("details")} className="rounded-lg border border-[var(--border)] px-5 py-3 font-semibold">חזרה לעריכה</button><button onClick={create} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "יוצר פרויקט…" : "אישור ויצירת פרויקט"}</button></div></section>}
    </div>
  </AppShell>;
}

function Field({ label, hint, value, onChange, required }: { label: string; hint?: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}{required && <span className="text-red-600"> *</span>}{hint && <span className="mr-2 font-normal text-[var(--muted)]">({hint})</span>}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-lg border border-[var(--border)] px-3 py-3 font-normal outline-none focus:border-blue-400"/></label>;
}
