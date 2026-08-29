import { ensureLocalUser, findProjectBySlug, getDatabase } from "@diratrack/database";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);

  if (!result) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!result.isCurrentSlug) {
    return NextResponse.json(
      { project: result.project, identifiers: result.identifiers, redirectTo: result.project.currentSlug },
      { headers: { Location: `/api/projects/${encodeURIComponent(result.project.currentSlug)}` } },
    );
  }

  return NextResponse.json({ project: result.project, identifiers: result.identifiers });
}
