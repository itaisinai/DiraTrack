import {
  configureProjectSources,
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
  listResearchRuns,
  startResearchRun,
} from "@diratrack/database";
import { mvpSourceCatalog } from "@diratrack/source-adapters";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const project = await resolveProject(context);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ researchRuns: await listResearchRuns(project.db, project.id) });
}

export async function POST(request: Request, context: Context) {
  const project = await resolveProject(context);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await parseOptionalBody(request);
  if (body instanceof NextResponse) return body;
  const approvedSourceKeys = new Set(mvpSourceCatalog.map((source) => source.key));
  const unknownSourceKeys = body.sourceKeys?.filter((key) => !approvedSourceKeys.has(key as (typeof mvpSourceCatalog)[number]["key"]));
  if (unknownSourceKeys?.length) {
    return NextResponse.json({ error: "Unknown source keys", unknownSourceKeys }, { status: 400 });
  }

  const sourcesThatRequireConsent = ["asia-cyrus"];
  const effectiveSourceKeys = body.sourceKeys ?? mvpSourceCatalog.map((s) => s.key);
  const requiresConsent = effectiveSourceKeys.some((key) => sourcesThatRequireConsent.includes(key));

  if (requiresConsent && body.externalDataConsent !== true) {
    return NextResponse.json({ error: "Explicit consent is required before sending project data to an external source" }, { status: 400 });
  }

  await configureProjectSources(project.db, project.id, mvpSourceCatalog);
  try {
    const run = await startResearchRun(project.db, project.id, body.sourceKeys);
    return NextResponse.json({ researchRun: run }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "No enabled research sources were selected") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

async function resolveProject(context: Context) {
  const { slug } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);
  return result ? { db, id: result.project.id } : null;
}

async function parseOptionalBody(request: Request): Promise<{ sourceKeys?: string[]; externalDataConsent?: boolean } | NextResponse> {
  if (!request.headers.get("content-type")?.includes("application/json")) return {};
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    const sourceKeys = (body as Record<string, unknown>).sourceKeys;
    const externalDataConsent = (body as Record<string, unknown>).externalDataConsent;
    if (externalDataConsent !== undefined && typeof externalDataConsent !== "boolean") {
      return NextResponse.json({ error: "externalDataConsent must be a boolean" }, { status: 400 });
    }
    if (sourceKeys === undefined) return { externalDataConsent };
    if (!Array.isArray(sourceKeys) || sourceKeys.some((key) => typeof key !== "string" || !key.trim())) {
      return NextResponse.json({ error: "sourceKeys must be an array of non-empty strings" }, { status: 400 });
    }
    if (sourceKeys.length === 0) {
      return NextResponse.json({ error: "sourceKeys must contain at least one source" }, { status: 400 });
    }
    return { sourceKeys, externalDataConsent };
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
    throw error;
  }
}
