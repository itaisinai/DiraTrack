import { StageTracker } from "@diratrack/shared-ui";

const navItems = ["לוח ראשי", "הפרויקט שלי", "ציר התקדמות", "מחקר", "ממצאים", "מסמכים", "פרטי הפרויקט", "הגדרות"];

export default function HomePage() {
  return <main className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
    <aside className="border-b border-[var(--border)] bg-white p-6 lg:min-h-screen lg:border-b-0 lg:border-l">
      <h1 className="text-2xl font-bold text-[var(--primary)]">DiraTrack</h1>
      <p className="mb-8 mt-1 text-sm text-[var(--muted)]">המערכת פועלת מקומית</p>
      <nav aria-label="ניווט ראשי"><ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">{navItems.map((item, index) => <li key={item}><a className={`block rounded-lg px-3 py-2 text-sm ${index === 1 ? "bg-blue-50 font-semibold text-[var(--primary)]" : "hover:bg-slate-50"}`} href="#">{item}</a></li>)}</ul></nav>
    </aside>
    <section className="p-5 sm:p-8 lg:p-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-[var(--muted)]">יהוד־מונוסון · אסיה סיירוס</p><h2 className="text-3xl font-bold">גני יהודה — הגרלה 2642</h2></div><button className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white">הפעלת מחקר חדש</button></header>
      <StageTracker currentStage="planning" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SummaryCard title="הסטטוס הנוכחי" body="תכנון ורישוי"/><SummaryCard title="מה השתנה לאחרונה" body="טרם הופעל מחקר"/><SummaryCard title="מה צפוי בהמשך" body="איתור תוכנית ומכרז רלוונטיים"/><SummaryCard title="מה עדיין לא ידוע" body="מספר תוכנית, מכרז ובקשה להיתר"/></div>
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-white p-6"><h3 className="text-xl font-semibold">התחלה מהירה</h3><p className="mt-2 text-[var(--muted)]">תשתית ה־MVP מוכנה. בשלב הבא נחבר את יצירת הפרויקט, מסד הנתונים ומנוע המחקר.</p></section>
    </section>
  </main>;
}

function SummaryCard({title, body}: {title: string; body: string}) {
  return <article className="rounded-xl border border-[var(--border)] border-r-4 border-r-slate-300 bg-white p-5"><h3 className="text-sm font-medium text-[var(--muted)]">{title}</h3><p className="mt-3 font-semibold">{body}</p></article>;
}
