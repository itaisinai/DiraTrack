"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

interface ProjectSummary { id: string; name: string; city: string; developer: string | null; currentSlug: string; operationalStatus: string; }

function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { fetch("/api/projects").then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ projects: ProjectSummary[] }>; }).then((result) => setProjects(result.projects)).catch(() => setError(true)); }, []);

  return <AppShell>
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-sm font-medium text-[var(--primary)]">לוח פרויקטים</p><h1 className="text-3xl font-bold">הפרויקטים שלי</h1><p className="mt-2 text-[var(--muted)]">כל המידע, המקורות והשינויים במקום אחד.</p></div><Link href="/projects/new" className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white hover:bg-blue-700">יצירת פרויקט</Link></header>
    {error && <StateCard title="מסד הנתונים אינו זמין" body="לא הצלחנו לטעון את הפרויקטים." action="ניסיון חוזר" onAction={() => location.reload()} />}
    {!error && projects === null && <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-[var(--muted)]">טוען פרויקטים…</div>}
    {!error && projects?.length === 0 && <StateCard title="עדיין אין פרויקטים" body="ניצור פרויקט ראשון ונוסיף רק מידע שתאשר." action="יצירת פרויקט" href="/projects/new" />}
    {projects && projects.length > 0 && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/projects/${encodeURIComponent(project.currentSlug)}`} className="group rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-5 flex items-start justify-between gap-4"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{project.operationalStatus}</span><span className="text-xl text-slate-300 group-hover:text-[var(--primary)]">←</span></div><h2 className="text-xl font-bold">{project.name}</h2><p className="mt-2 text-sm text-[var(--muted)]">{[project.city, project.developer].filter(Boolean).join(" · ")}</p></Link>)}</div>}
  </AppShell>;
}

export default ProjectsPage;

function StateCard({ title, body, action, href, onAction }: { title: string; body: string; action: string; href?: string; onAction?: () => void }) {
  const classes = "mt-6 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-white";
  return <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-[var(--muted)]">{body}</p>{href ? <Link className={classes} href={href}>{action}</Link> : <button className={classes} onClick={onAction}>{action}</button>}</section>;
}
