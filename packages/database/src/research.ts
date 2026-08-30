import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { getDatabase } from "./index.ts";
import { findings, projectIdentifiers, projects, projectSources, researchJobs, researchRuns, sourceChecks, sources } from "./schema.ts";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface SourceDefinition {
  key: string;
  name: string;
  category: "official" | "municipal" | "developer" | "private" | "user-upload";
  baseUrl: string | null;
  adapterKey: string;
}

export async function configureProjectSources(db: Database, projectId: string, catalog: readonly SourceDefinition[]) {
  return db.transaction(async (transaction) => {
    for (const definition of catalog) {
      const [source] = await transaction
        .insert(sources)
        .values(definition)
        .onConflictDoUpdate({
          target: sources.key,
          set: { name: definition.name, category: definition.category, baseUrl: definition.baseUrl, adapterKey: definition.adapterKey },
        })
        .returning();
      if (!source) throw new Error(`Failed to configure source ${definition.key}`);

      await transaction.insert(projectSources).values({ projectId, sourceId: source.id }).onConflictDoNothing();
    }
  });
}

export async function startResearchRun(db: Database, projectId: string, requestedSourceKeys?: string[]) {
  return db.transaction(async (transaction) => {
    const configuredSources = await transaction
      .select({ id: sources.id, key: sources.key })
      .from(projectSources)
      .innerJoin(sources, eq(sources.id, projectSources.sourceId))
      .where(
        and(
          eq(projectSources.projectId, projectId),
          eq(projectSources.isEnabled, true),
          eq(sources.isEnabled, true),
          requestedSourceKeys?.length ? inArray(sources.key, requestedSourceKeys) : undefined,
        ),
      )
      .orderBy(asc(sources.name));

    if (!configuredSources.length) throw new Error("No enabled research sources were selected");

    const selectedKeys = configuredSources.map((source) => source.key);
    const [run] = await transaction
      .insert(researchRuns)
      .values({ projectId, requestedSources: selectedKeys })
      .returning();
    if (!run) throw new Error("Failed to create research run");

    const checks = await transaction
      .insert(sourceChecks)
      .values(configuredSources.map((source) => ({ projectId, researchRunId: run.id, sourceId: source.id })))
      .returning({ id: sourceChecks.id, sourceId: sourceChecks.sourceId });
    const keysBySourceId = new Map(configuredSources.map((source) => [source.id, source.key]));

    await transaction.insert(researchJobs).values(
      checks.map((check) => ({
        projectId,
        researchRunId: run.id,
        sourceCheckId: check.id,
        payload: { sourceKey: keysBySourceId.get(check.sourceId) },
      })),
    );

    return { ...run, sourceCount: checks.length };
  });
}

export async function listResearchRuns(db: Database, projectId: string) {
  return db.select().from(researchRuns).where(eq(researchRuns.projectId, projectId)).orderBy(sql`${researchRuns.createdAt} desc`);
}

export async function getResearchRunDetails(db: Database, projectId: string, researchRunId: string) {
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, researchRunId), eq(researchRuns.projectId, projectId)))
    .limit(1);
  if (!run) return null;

  const checks = await db
    .select({
      id: sourceChecks.id,
      status: sourceChecks.status,
      progress: sourceChecks.progress,
      resultCount: sourceChecks.resultCount,
      error: sourceChecks.error,
      manualAction: sourceChecks.manualAction,
      startedAt: sourceChecks.startedAt,
      completedAt: sourceChecks.completedAt,
      source: {
        key: sources.key,
        name: sources.name,
        category: sources.category,
        baseUrl: sources.baseUrl,
      },
    })
    .from(sourceChecks)
    .innerJoin(sources, eq(sources.id, sourceChecks.sourceId))
    .where(and(eq(sourceChecks.projectId, projectId), eq(sourceChecks.researchRunId, researchRunId)))
    .orderBy(asc(sources.name));

  const runFindings = await db
    .select({
      id: findings.id,
      sourceCheckId: findings.sourceCheckId,
      title: findings.title,
      summary: findings.summary,
      sourceUrl: findings.sourceUrl,
      verificationStatus: findings.verificationStatus,
      matchingIdentifiers: findings.matchingIdentifiers,
      discoveredAt: findings.discoveredAt,
    })
    .from(findings)
    .innerJoin(sourceChecks, and(eq(sourceChecks.id, findings.sourceCheckId), eq(sourceChecks.projectId, findings.projectId)))
    .where(and(eq(findings.projectId, projectId), eq(sourceChecks.researchRunId, researchRunId)))
    .orderBy(asc(findings.discoveredAt));

  return { run, sourceChecks: checks, findings: runFindings };
}

export async function cancelResearchRun(db: Database, projectId: string, researchRunId: string) {
  return db.transaction(async (transaction) => {
    const [run] = await transaction
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.id, researchRunId), eq(researchRuns.projectId, projectId)))
      .limit(1)
      .for("update");
    if (!run) return null;
    if (!["pending", "running", "waiting-for-user"].includes(run.status)) return { run, changed: false };

    const now = new Date();
    const [cancelledRun] = await transaction
      .update(researchRuns)
      .set({ status: "cancelled", completedAt: now })
      .where(and(eq(researchRuns.id, researchRunId), eq(researchRuns.projectId, projectId)))
      .returning();

    await transaction
      .update(researchJobs)
      .set({ status: "cancelled", completedAt: now, lockedBy: null, lockedAt: null })
      .where(and(eq(researchJobs.projectId, projectId), eq(researchJobs.researchRunId, researchRunId), inArray(researchJobs.status, ["pending", "running", "waiting-for-user"])));
    await transaction
      .update(sourceChecks)
      .set({ status: "skipped", error: "research-cancelled", completedAt: now })
      .where(and(eq(sourceChecks.projectId, projectId), eq(sourceChecks.researchRunId, researchRunId), inArray(sourceChecks.status, ["pending", "running", "waiting-for-user"])));

    return { run: cancelledRun!, changed: true };
  });
}

export async function claimNextResearchJob(db: Database, workerId: string, leaseTimeoutMs = 5 * 60_000) {
  if (!Number.isFinite(leaseTimeoutMs) || leaseTimeoutMs <= 0) throw new Error("leaseTimeoutMs must be positive");
  const staleBefore = new Date(Date.now() - leaseTimeoutMs);

  return db.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select()
      .from(researchJobs)
      .where(
        or(
          eq(researchJobs.status, "pending"),
          and(eq(researchJobs.status, "running"), lt(researchJobs.lockedAt, staleBefore)),
        ),
      )
      .orderBy(asc(researchJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;

    const now = new Date();
    const [job] = await transaction
      .update(researchJobs)
      .set({ status: "running", lockedBy: workerId, lockedAt: now, startedAt: now, attempts: sql`${researchJobs.attempts} + 1` })
      .where(eq(researchJobs.id, candidate.id))
      .returning();
    if (!job) throw new Error("Failed to claim research job");

    await transaction.update(researchRuns).set({ status: "running", startedAt: sql`coalesce(${researchRuns.startedAt}, ${now})` }).where(eq(researchRuns.id, job.researchRunId!));
    if (job.sourceCheckId) {
      await transaction.update(sourceChecks).set({ status: "running", startedAt: now }).where(eq(sourceChecks.id, job.sourceCheckId));
    }
    return job;
  });
}

export async function getResearchContext(db: Database, projectId: string) {
  const [project] = await db
    .select({ name: projects.name, city: projects.city, developer: projects.developer })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return null;
  const identifiers = await db
    .select({ type: projectIdentifiers.type, value: projectIdentifiers.value })
    .from(projectIdentifiers)
    .where(eq(projectIdentifiers.projectId, projectId));
  return { project, identifiers };
}

export interface ResearchDiscovery {
  externalId: string;
  title: string;
  sourceUrl: string;
  summary: string;
  matchingIdentifiers: Array<{ type: string; value: string }>;
  metadata: Record<string, unknown>;
}

export async function completeResearchJob(
  db: Database,
  job: NonNullable<Awaited<ReturnType<typeof claimNextResearchJob>>>,
  discoveries: ResearchDiscovery[],
) {
  await db.transaction(async (transaction) => {
    const now = new Date();
    const [completedJob] = await transaction
      .update(researchJobs)
      .set({ status: "completed", progress: 100, completedAt: now, lockedBy: null, lockedAt: null })
      .where(and(eq(researchJobs.id, job.id), eq(researchJobs.status, "running"), eq(researchJobs.lockedBy, job.lockedBy!)))
      .returning({ id: researchJobs.id });
    if (!completedJob || !job.sourceCheckId) return;

    for (const discovery of discoveries) {
      await transaction
        .insert(findings)
        .values({
          projectId: job.projectId,
          sourceCheckId: job.sourceCheckId,
          externalId: discovery.externalId,
          title: discovery.title,
          summary: discovery.summary,
          sourceUrl: discovery.sourceUrl,
          verificationStatus: "requires-review",
          matchingIdentifiers: discovery.matchingIdentifiers,
          rawMetadata: discovery.metadata,
        })
        .onConflictDoUpdate({
          target: [findings.projectId, findings.sourceCheckId, findings.externalId],
          set: { title: discovery.title, summary: discovery.summary, sourceUrl: discovery.sourceUrl, matchingIdentifiers: discovery.matchingIdentifiers, rawMetadata: discovery.metadata, updatedAt: now },
        });
    }

    await transaction
      .update(sourceChecks)
      .set({ status: discoveries.length ? "results-found" : "no-results", progress: 100, resultCount: discoveries.length, error: null, completedAt: now })
      .where(and(eq(sourceChecks.id, job.sourceCheckId), eq(sourceChecks.projectId, job.projectId)));
    await updateRunCompletion(transaction, job.researchRunId!, now);
  });
}

export async function failResearchJob(db: Database, job: NonNullable<Awaited<ReturnType<typeof claimNextResearchJob>>>, error: unknown) {
  await db.transaction(async (transaction) => {
    const now = new Date();
    const message = error instanceof Error ? error.message : "Unknown research adapter error";
    const [failedJob] = await transaction
      .update(researchJobs)
      .set({ status: "failed", progress: 100, error: message, completedAt: now, lockedBy: null, lockedAt: null })
      .where(and(eq(researchJobs.id, job.id), eq(researchJobs.status, "running"), eq(researchJobs.lockedBy, job.lockedBy!)))
      .returning({ id: researchJobs.id });
    if (!failedJob) return;
    if (job.sourceCheckId) {
      await transaction
        .update(sourceChecks)
        .set({ status: "failed", progress: 100, error: message, completedAt: now })
        .where(and(eq(sourceChecks.id, job.sourceCheckId), eq(sourceChecks.projectId, job.projectId)));
    }
    await updateRunCompletion(transaction, job.researchRunId!, now);
  });
}

export async function skipUnimplementedResearchJob(db: Database, job: NonNullable<Awaited<ReturnType<typeof claimNextResearchJob>>>) {
  await db.transaction(async (transaction) => {
    const now = new Date();
    const [completedJob] = await transaction
      .update(researchJobs)
      .set({ status: "completed", progress: 100, completedAt: now, lockedBy: null, lockedAt: null })
      .where(and(eq(researchJobs.id, job.id), eq(researchJobs.status, "running"), eq(researchJobs.lockedBy, job.lockedBy!)))
      .returning({ id: researchJobs.id });
    if (!completedJob) return;

    if (job.sourceCheckId) {
      await transaction
        .update(sourceChecks)
        .set({ status: "skipped", progress: 100, error: "adapter-not-implemented", completedAt: now })
        .where(and(eq(sourceChecks.id, job.sourceCheckId), eq(sourceChecks.projectId, job.projectId)));
    }

    await transaction
      .select({ id: researchRuns.id })
      .from(researchRuns)
      .where(eq(researchRuns.id, job.researchRunId!))
      .for("update");

    const remaining = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(researchJobs)
      .where(and(eq(researchJobs.researchRunId, job.researchRunId!), inArray(researchJobs.status, ["pending", "running"])));
    if ((remaining[0]?.count ?? 0) === 0) {
      await transaction
        .update(researchRuns)
        .set({ status: "completed-with-errors", progress: 100, completedAt: now })
        .where(eq(researchRuns.id, job.researchRunId!));
    }
  });
}

async function updateRunCompletion(transaction: Transaction, researchRunId: string, now: Date) {
  const [run] = await transaction
    .select({ status: researchRuns.status })
    .from(researchRuns)
    .where(eq(researchRuns.id, researchRunId))
    .for("update");
  if (!run || run.status === "cancelled") return;

  const [jobCounts] = await transaction
    .select({
      total: sql<number>`count(*)::int`,
      remaining: sql<number>`count(*) filter (where ${researchJobs.status} in ('pending', 'running', 'waiting-for-user'))::int`,
    })
    .from(researchJobs)
    .where(eq(researchJobs.researchRunId, researchRunId));
  const total = jobCounts?.total ?? 0;
  const remaining = jobCounts?.remaining ?? 0;
  const progress = total ? Math.round(((total - remaining) / total) * 100) : 0;

  if (remaining) {
    await transaction.update(researchRuns).set({ progress }).where(eq(researchRuns.id, researchRunId));
    return;
  }

  const [problemChecks] = await transaction
    .select({ count: sql<number>`count(*)::int` })
    .from(sourceChecks)
    .where(and(eq(sourceChecks.researchRunId, researchRunId), inArray(sourceChecks.status, ["failed", "skipped"])));
  await transaction
    .update(researchRuns)
    .set({ status: (problemChecks?.count ?? 0) ? "completed-with-errors" : "completed", progress: 100, completedAt: now })
    .where(eq(researchRuns.id, researchRunId));
}
