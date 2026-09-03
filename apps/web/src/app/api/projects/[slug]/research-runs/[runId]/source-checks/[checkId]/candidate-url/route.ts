import {
  completeManualActionWithCandidateUrl,
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
} from "@diratrack/database";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ slug: string; runId: string; checkId: string }>;
};

interface CandidateUrlBody {
  url: string;
  title?: string;
  notes?: string;
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

  // Additional URL validation
  if (!body.url.startsWith("https://")) {
    return NextResponse.json(
      { error: "URL must start with https://" },
      { status: 400 },
    );
  }

  // Reject dangerous schemes
  const dangerousSchemes = ["javascript:", "data:", "file:", "vbscript:"];
  if (dangerousSchemes.some((scheme) => body.url.toLowerCase().startsWith(scheme))) {
    return NextResponse.json(
      { error: "Invalid URL scheme" },
      { status: 400 },
    );
  }

  try {
    const result_data = await completeManualActionWithCandidateUrl(
      db,
      result.project.id,
      runId,
      checkId,
      body.url,
      body.title,
      body.notes,
      user.id,
    );

    return NextResponse.json(
      { check: result_data.check, finding: result_data.finding },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.includes("must be in waiting-for-user state") ||
        error.message.includes("URL must start with") ||
        error.message.includes("Invalid URL scheme")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    throw error;
  }
}

async function parseBody(request: Request): Promise<CandidateUrlBody | NextResponse> {
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

    const { url, title, notes } = body as Record<string, unknown>;

    // Validate required url field
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: "url is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    // Validate optional fields
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json(
        { error: "title must be a non-empty string if provided" },
        { status: 400 },
      );
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { error: "notes must be a string if provided" },
        { status: 400 },
      );
    }

    return {
      url: url.trim(),
      title: title ? (title as string).trim() : undefined,
      notes: notes ? (notes as string) : undefined,
    };
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
