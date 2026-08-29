import { createProject, ensureLocalUser, getDatabase, listProjects } from "@diratrack/database";
import { NextResponse } from "next/server";
import { InputError, parseCreateProjectInput } from "@/server/project-input";

export async function GET() {
  const db = getDatabase();
  const user = await ensureLocalUser(db);
  return NextResponse.json({ projects: await listProjects(db, user.id) });
}

export async function POST(request: Request) {
  try {
    const input = parseCreateProjectInput(await request.json());
    const db = getDatabase();
    const user = await ensureLocalUser(db);
    const project = await createProject(db, user.id, input);
    return NextResponse.json({ project }, { status: 201, headers: { Location: `/api/projects/${encodeURIComponent(project.currentSlug)}` } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof InputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) return NextResponse.json({ error: "A project with this slug or identifier already exists" }, { status: 409 });
    throw error;
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
