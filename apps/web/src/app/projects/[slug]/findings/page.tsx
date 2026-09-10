"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { encodeRouteSegment } from "@/lib/route-segment";

interface Finding {
  id: string;
  summary: string;
  title: string;
  category: string;
  sourceKey: string;
  sourceName: string;
  verificationStatus: string;
  sourceUrl: string | null;
  matchingIdentifiers: unknown;
  discoveredAt: string;
}

function FindingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const encodedSlug = encodeRouteSegment(slug);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${encodedSlug}/findings`)
      .then(async (response) => {
        if (!response.ok) throw new Error("לא ניתן לטעון ממצאים");
        return response.json();
      })
      .then((result: { findings: Finding[] }) => {
        setFindings(result.findings);
        setLoading(false);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "לא ניתן לטעון ממצאים");
        setLoading(false);
      });
  }, [encodedSlug]);

  return (
    <AppShell>
      <header className="mb-8">
        <Link href={`/projects/${encodedSlug}`} className="text-sm font-medium text-[var(--primary)]">
          ← חזרה לפרויקט
        </Link>
        <h1 className="mt-5 text-3xl font-bold">ממצאים</h1>
        <p className="mt-2 text-[var(--muted)]">כל הממצאים שנמצאו במחקרים של הפרויקט</p>
      </header>

      {loading && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-[var(--muted)]">
          טוען ממצאים...
        </div>
      )}

      {error && !loading && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-8">
          <h2 className="text-xl font-bold">{error}</h2>
          <Link href={`/projects/${encodedSlug}`} className="mt-4 inline-block font-semibold text-[var(--primary)]">
            חזרה לפרויקט
          </Link>
        </section>
      )}

      {!loading && !error && findings.length === 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-white p-8 text-center">
          <p className="text-lg text-[var(--muted)]">לא נמצאו ממצאים</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ממצאים יופיעו כאן לאחר הפעלת מחקר
          </p>
          <Link
            href={`/projects/${encodedSlug}`}
            className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white"
          >
            הפעלת מחקר חדש
          </Link>
        </section>
      )}

      {!loading && !error && findings.length > 0 && (
        <div className="grid gap-4">
          {findings.map((finding) => (
            <article
              key={finding.id}
              className="rounded-xl border border-[var(--border)] bg-white p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{finding.title}</h2>
                  <p className="mt-2 text-[var(--muted)]">{finding.summary}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {finding.category} · {finding.sourceName} · {finding.verificationStatus} ·{" "}
                    {new Date(finding.discoveredAt).toLocaleDateString("he-IL")}
                  </p>
                  {finding.sourceUrl && (
                    <a
                      href={finding.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm text-[var(--primary)] underline"
                    >
                      מקור ↗
                    </a>
                  )}
                  {Array.isArray(finding.matchingIdentifiers) && finding.matchingIdentifiers.length > 0 ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      מזהים: {finding.matchingIdentifiers.map((id: unknown) => JSON.stringify(id)).join(', ')}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/projects/${encodedSlug}/findings/${encodeRouteSegment(finding.id)}`}
                  className="text-sm font-semibold text-[var(--primary)]"
                >
                  צפייה בממצא →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default FindingsPage;
