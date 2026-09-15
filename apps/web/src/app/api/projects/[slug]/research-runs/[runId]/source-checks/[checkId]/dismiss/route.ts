import {
  dismissManualAction,
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
} from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ slug: string; runId: string; checkId: string }>;
};

interface DismissBody {
  reason: string;
}

export async function POST(request: Request, context: Context) {
  const { slug, runId, checkId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  // Resolve project and validate ownership
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Parse and validate request body
  const body = await parseBody(request);
  if (body instanceof NextResponse) return body;

  try {
    const updatedCheck = await dismissManualAction(
      db,
      result.project.id,
      runId,
      checkId,
      body.reason,
      user.id,
    );

    return NextResponse.json({ check: updatedCheck }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("must be in waiting-for-user state")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    throw error;
  }
}

async function parseBody(request: Request): Promise<DismissBody | NextResponse> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 400 },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 },
      );
    }

    const { reason } = body as Record<string, unknown>;

    // Validate required reason field
    if (typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "reason is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    return { reason: reason.trim() };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body is not valid JSON" },
        { status: 400 },
      );
    }
    throw error;
  }
}
