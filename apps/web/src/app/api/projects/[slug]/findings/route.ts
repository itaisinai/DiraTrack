import {
  ensureLocalUser,
  findProjectBySlug,
  findings,
  getDatabase,
  sourceChecks,
  sources,
} from "@diratrack/database";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string }> };

interface FindingDTO {
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

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);

  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectFindings = await db
    .select({
      id: findings.id,
      summary: findings.summary,
      title: findings.title,
      verificationStatus: findings.verificationStatus,
      sourceUrl: findings.sourceUrl,
      matchingIdentifiers: findings.matchingIdentifiers,
      discoveredAt: findings.discoveredAt,
      sourceKey: sources.key,
      sourceName: sources.name,
      sourceCategory: sources.category,
    })
    .from(findings)
    .innerJoin(sourceChecks, eq(findings.sourceCheckId, sourceChecks.id))
    .innerJoin(sources, eq(sourceChecks.sourceId, sources.id))
    .where(eq(findings.projectId, result.project.id))
    .orderBy(desc(findings.discoveredAt));

  const dtos: FindingDTO[] = projectFindings.map((row) => ({
    id: row.id,
    summary: row.summary,
    title: row.title,
    category: row.sourceCategory,
    sourceKey: row.sourceKey,
    sourceName: row.sourceName,
    verificationStatus: row.verificationStatus,
    sourceUrl: row.sourceUrl,
    matchingIdentifiers: row.matchingIdentifiers,
    discoveredAt: row.discoveredAt.toISOString(),
  }));

  return NextResponse.json({ findings: dtos });
}
