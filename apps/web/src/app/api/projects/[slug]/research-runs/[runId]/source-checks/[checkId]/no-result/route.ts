import {
  completeManualActionWithNoResult,
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
} from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ slug: string; runId: string; checkId: string }>;
};

export async function POST(_request: Request, context: Context) {
  const { slug, runId, checkId } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  // Resolve project and validate ownership
  const result = await findProjectBySlug(db, user.id, slug);
  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const updatedCheck = await completeManualActionWithNoResult(
      db,
      result.project.id,
      runId,
      checkId,
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
