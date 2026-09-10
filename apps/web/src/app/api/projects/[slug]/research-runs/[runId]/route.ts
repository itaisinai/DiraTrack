import {
  cancelResearchRun,
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
  getResearchRunDetails,
} from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string; runId: string }> };

export async function GET(_request: Request, context: Context) {
  const resolved = await resolveResearchRun(context);
  if (!resolved) return NextResponse.json({ error: "Research run not found" }, { status: 404 });
  // Flatten structure for API: researchRun is just the run, sourceChecks and findings are siblings
  return NextResponse.json({
    researchRun: resolved.details.run,
    sourceChecks: resolved.details.sourceChecks,
    findings: resolved.details.findings,
  });
}

export async function DELETE(_request: Request, context: Context) {
  const { slug, runId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const cancelled = await cancelResearchRun(db, result.project.id, runId);
  if (!cancelled) return NextResponse.json({ error: "Research run not found" }, { status: 404 });
  return NextResponse.json({ researchRun: cancelled.run, changed: cancelled.changed });
}

async function resolveResearchRun(context: Context) {
  const { slug, runId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) return null;
  const details = await getResearchRunDetails(db, result.project.id, runId);
  return details ? { details } : null;
}
