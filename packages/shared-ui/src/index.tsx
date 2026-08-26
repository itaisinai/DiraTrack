import type { ProjectStage } from "@diratrack/domain";

const stages: Array<{id: ProjectStage; label: string}> = [
  {id: "winning", label: "זכייה"}, {id: "planning", label: "תכנון"}, {id: "building-permit", label: "היתר בנייה"},
  {id: "apartment-selection-and-contract", label: "בחירת דירה וחוזה"}, {id: "construction", label: "בנייה"},
  {id: "occupancy-approval", label: "אישור אכלוס"}, {id: "delivery", label: "מסירה"},
];

export function StageTracker({currentStage}: {currentStage: ProjectStage}) {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);
  return <section aria-labelledby="project-progress" className="rounded-xl border border-[var(--border)] bg-white p-6">
    <h3 id="project-progress" className="mb-5 text-lg font-semibold">ציר התקדמות הפרויקט</h3>
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{stages.map((stage, index) => {
      const status = index < currentIndex ? "הושלם" : index === currentIndex ? "בתהליך" : "ממתין";
      return <li key={stage.id} className="rounded-lg border border-[var(--border)] p-3"><span className={`mb-2 block h-2 rounded-full ${index <= currentIndex ? "bg-[var(--primary)]" : "bg-slate-200"}`}/><span className="block text-sm font-semibold">{stage.label}</span><span className="mt-1 block text-xs text-[var(--muted)]">{status}</span></li>;
    })}</ol>
  </section>;
}
