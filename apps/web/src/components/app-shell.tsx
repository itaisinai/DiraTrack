import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children, active = "projects" }: { children: ReactNode; active?: "projects" | "research" }) {
  const items = [
    { key: "projects", label: "הפרויקטים שלי", href: "/" },
    { key: "research", label: "מחקר", href: "/" },
  ] as const;

  return <main className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
    <aside className="border-b border-[var(--border)] bg-white p-6 lg:min-h-screen lg:border-b-0 lg:border-l">
      <Link href="/" className="text-2xl font-bold text-[var(--primary)]">DiraTrack</Link>
      <p className="mb-8 mt-1 text-sm text-[var(--muted)]">מעקב מבוסס מקורות</p>
      <nav aria-label="ניווט ראשי"><ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">{items.map((item) => <li key={item.key}><Link className={`block rounded-lg px-3 py-2 text-sm ${active === item.key ? "bg-blue-50 font-semibold text-[var(--primary)]" : "hover:bg-slate-50"}`} href={item.href}>{item.label}</Link></li>)}</ul></nav>
    </aside>
    <section className="p-5 sm:p-8 lg:p-12">{children}</section>
  </main>;
}
