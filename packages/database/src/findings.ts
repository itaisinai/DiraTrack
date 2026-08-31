import { and, eq } from "drizzle-orm";
import type { getDatabase } from "./index.ts";
import { auditEvents, findings, researchRuns, sourceChecks, sources } from "./schema.ts";

type Database = ReturnType<typeof getDatabase>;
export type FindingDecision = "relevant" | "irrelevant";

export async function getFindingDetails(db: Database, projectId: string, findingId: string) {
  const [finding] = await db
    .select({
      id: findings.id,
      title: findings.title,
      summary: findings.summary,
      sourceUrl: findings.sourceUrl,
      verificationStatus: findings.verificationStatus,
      isRelevant: findings.isRelevant,
      matchingIdentifiers: findings.matchingIdentifiers,
      rawMetadata: findings.rawMetadata,
      discoveredAt: findings.discoveredAt,
      updatedAt: findings.updatedAt,
      sourceCheckId: sourceChecks.id,
      researchRunId: researchRuns.id,
      source: { key: sources.key, name: sources.name, category: sources.category, baseUrl: sources.baseUrl },
    })
    .from(findings)
    .innerJoin(sourceChecks, and(eq(sourceChecks.id, findings.sourceCheckId), eq(sourceChecks.projectId, findings.projectId)))
    .innerJoin(researchRuns, and(eq(researchRuns.id, sourceChecks.researchRunId), eq(researchRuns.projectId, findings.projectId)))
    .innerJoin(sources, eq(sources.id, sourceChecks.sourceId))
    .where(and(eq(findings.id, findingId), eq(findings.projectId, projectId)))
    .limit(1);
  return finding ?? null;
}

export async function reviewFinding(db: Database, projectId: string, findingId: string, decision: FindingDecision) {
  return db.transaction(async (transaction) => {
    const [before] = await transaction
      .select()
      .from(findings)
      .where(and(eq(findings.id, findingId), eq(findings.projectId, projectId)))
      .limit(1)
      .for("update");
    if (!before) return null;

    const [after] = await transaction
      .update(findings)
      .set({
        isRelevant: decision === "relevant",
        verificationStatus: decision === "relevant" ? "requires-review" : "rejected",
        updatedAt: new Date(),
      })
      .where(and(eq(findings.id, findingId), eq(findings.projectId, projectId)))
      .returning();
    if (!after) throw new Error("Failed to review finding");

    await transaction.insert(auditEvents).values({
      projectId,
      actor: "user",
      action: decision === "relevant" ? "finding.marked-relevant" : "finding.marked-irrelevant",
      entityType: "finding",
      entityId: findingId,
      before: { isRelevant: before.isRelevant, verificationStatus: before.verificationStatus },
      after: { isRelevant: after.isRelevant, verificationStatus: after.verificationStatus },
    });
    return after;
  });
}
