import {
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
  getResearchRunDetails,
} from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ slug: string; runId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { slug, runId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  // Resolve project and validate ownership
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get research run details
  const details = await getResearchRunDetails(db, result.project.id, runId);
  if (!details) {
    return NextResponse.json({ error: "Research run not found" }, { status: 404 });
  }

  // Calculate summary statistics from sourceChecks
  const totalSources = details.sourceChecks.length;
  const completed = details.sourceChecks.filter(
    (check) => check.status === "completed" || check.status === "results-found"
  ).length;
  const noResults = details.sourceChecks.filter(
    (check) => check.status === "no-results"
  ).length;
  const failed = details.sourceChecks.filter(
    (check) => check.status === "failed"
  ).length;
  const skipped = details.sourceChecks.filter(
    (check) => check.status === "skipped"
  ).length;
  const waitingForUser = details.sourceChecks.filter(
    (check) => check.status === "waiting-for-user"
  ).length;
  const pending = details.sourceChecks.filter(
    (check) => check.status === "pending"
  ).length;
  const running = details.sourceChecks.filter(
    (check) => check.status === "running"
  ).length;

  // Calculate findings count
  const findingsCount = details.findings.length;

  // Get start and end times from run
  const startedAt = details.run.startedAt;
  const completedAt = details.run.completedAt;

  // Check if retry is available (if there are any failed checks)
  const retryAvailable = failed > 0;

  // Check if manual action is required
  const manualActionRequired = waitingForUser > 0;

  const summary = {
    totalSources,
    completed,
    noResults,
    failed,
    skipped,
    waitingForUser,
    pending,
    running,
    findingsCount,
    startedAt,
    completedAt,
    retryAvailable,
    manualActionRequired,
    status: details.run.status,
    progress: details.run.progress,
  };

  return NextResponse.json({ summary }, { status: 200 });
}
