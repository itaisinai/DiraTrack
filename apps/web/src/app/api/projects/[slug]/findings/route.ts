import {
  ensureLocalUser,
  findProjectBySlug,
  findings,
  getDatabase,
} from "@diratrack/database";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);

  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.projectId, result.project.id))
    .orderBy(desc(findings.createdAt));

  return NextResponse.json({ findings: projectFindings });
}
