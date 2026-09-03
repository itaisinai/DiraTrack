import { ensureLocalUser, findProjectBySlug, getDatabase, getFindingDetails, reviewFinding } from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string; findingId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const resolved = await resolveProjectFinding(context);
    if (!resolved) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    return NextResponse.json({ finding: resolved.finding });
  } catch (error) {
    // Handle database errors (e.g., invalid UUID format)
    if (error && typeof error === "object" && "code" in error) {
      // PostgreSQL error codes: 22P02 = invalid text representation
      if (error.code === "22P02") {
        return NextResponse.json({ error: "Finding not found" }, { status: 404 });
      }
    }
    throw error;
  }
}

export async function PATCH(request: Request, context: Context) {
  const resolved = await resolveProjectFinding(context);
  if (!resolved) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const body = await parseDecision(request);
  if (body instanceof NextResponse) return body;
  const finding = await reviewFinding(resolved.db, resolved.projectId, resolved.finding.id, body.decision);
  return NextResponse.json({ finding });
}

async function resolveProjectFinding(context: Context) {
  const { slug, findingId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) return null;
  const finding = await getFindingDetails(db, result.project.id, findingId);
  return finding ? { db, projectId: result.project.id, finding } : null;
}

async function parseDecision(request: Request) {
  try {
    const body: unknown = await request.json();
    const decision = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).decision : undefined;
    if (decision !== "relevant" && decision !== "irrelevant") {
      return NextResponse.json({ error: "decision must be relevant or irrelevant" }, { status: 400 });
    }
    return { decision } as const;
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
    throw error;
  }
}
