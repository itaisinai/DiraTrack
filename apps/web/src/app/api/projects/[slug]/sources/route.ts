import {
  ensureLocalUser,
  findProjectBySlug,
  getDatabase,
  projectSources,
  sources,
} from "@diratrack/database";
import { getSourceAdapter, mvpSourceCatalog } from "@diratrack/source-adapters";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const project = await resolveProject(context);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const result = await project.db
    .select({
      sourceKey: sources.key,
      sourceName: sources.name,
      category: sources.category,
      baseUrl: sources.baseUrl,
      adapterKey: sources.adapterKey,
      isEnabled: projectSources.isEnabled,
      lastCheckedAt: projectSources.lastCheckedAt,
    })
    .from(projectSources)
    .innerJoin(sources, eq(sources.id, projectSources.sourceId))
    .where(eq(projectSources.projectId, project.id))
    .orderBy(sources.category, sources.name);

  const sourcesWithMetadata = result.map((row) => {
    const adapter = row.adapterKey ? getSourceAdapter(row.sourceKey as string) : null;
    const isImplemented = adapter !== null;

    const requiresManualAction = row.sourceKey === "discounted-housing";
    const sendsExternalData = row.sourceKey === "asia-cyrus";

    return {
      key: row.sourceKey,
      name: row.sourceName,
      category: row.category,
      baseUrl: row.baseUrl,
      adapterKey: row.adapterKey,
      isEnabled: row.isEnabled,
      isImplemented,
      requiresManualAction,
      sendsExternalData,
      lastCheckedAt: row.lastCheckedAt,
      lastResultStatus: null, // TODO: Get from most recent sourceCheck
    };
  });

  return NextResponse.json({ sources: sourcesWithMetadata });
}

export async function PATCH(request: Request, context: Context) {
  const project = await resolveProject(context);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await parseBody(request);
  if (body instanceof NextResponse) return body;

  const catalogByKey = new Map(mvpSourceCatalog.map((s) => [s.key, s]));
  if (!catalogByKey.has(body.sourceKey as typeof mvpSourceCatalog[number]["key"])) {
    return NextResponse.json({ error: "Unknown source key" }, { status: 400 });
  }

  const [source] = await project.db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.key, body.sourceKey))
    .limit(1);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const [updated] = await project.db
    .update(projectSources)
    .set({ isEnabled: body.isEnabled })
    .where(and(eq(projectSources.projectId, project.id), eq(projectSources.sourceId, source.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }

  const [result] = await project.db
    .select({
      sourceKey: sources.key,
      sourceName: sources.name,
      category: sources.category,
      baseUrl: sources.baseUrl,
      adapterKey: sources.adapterKey,
      isEnabled: projectSources.isEnabled,
      lastCheckedAt: projectSources.lastCheckedAt,
    })
    .from(projectSources)
    .innerJoin(sources, eq(sources.id, projectSources.sourceId))
    .where(and(eq(projectSources.projectId, project.id), eq(sources.id, source.id)))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Failed to retrieve updated source" }, { status: 500 });
  }

  const adapter = result.adapterKey ? getSourceAdapter(result.sourceKey as string) : null;
  const isImplemented = adapter !== null;
  const requiresManualAction = result.sourceKey === "discounted-housing";
  const sendsExternalData = result.sourceKey === "asia-cyrus";

  return NextResponse.json({
    source: {
      key: result.sourceKey,
      name: result.sourceName,
      category: result.category,
      baseUrl: result.baseUrl,
      adapterKey: result.adapterKey,
      isEnabled: result.isEnabled,
      isImplemented,
      requiresManualAction,
      sendsExternalData,
      lastCheckedAt: result.lastCheckedAt,
      lastResultStatus: null,
    },
  });
}

async function resolveProject(context: Context) {
  const { slug } = await context.params;
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  const result = await findProjectBySlug(db, user.id, slug);
  return result ? { db, id: result.project.id } : null;
}

async function parseBody(request: Request): Promise<{ sourceKey: string; isEnabled: boolean } | NextResponse> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const { sourceKey, isEnabled } = body as Record<string, unknown>;

    if (typeof sourceKey !== "string" || !sourceKey.trim()) {
      return NextResponse.json({ error: "sourceKey must be a non-empty string" }, { status: 400 });
    }

    if (typeof isEnabled !== "boolean") {
      return NextResponse.json({ error: "isEnabled must be a boolean" }, { status: 400 });
    }

    return { sourceKey, isEnabled };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
    }
    throw error;
  }
}
