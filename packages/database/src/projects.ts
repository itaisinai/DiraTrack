import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { getDatabase } from "./index.ts";
import {
  auditEvents,
  projectIdentifiers,
  projectSlugs,
  projects,
  users,
  identifierOriginEnum,
  identifierTypeEnum,
} from "./schema.ts";
import { toProjectSlug } from "./slug.ts";

type Database = ReturnType<typeof getDatabase>;
type IdentifierType = (typeof identifierTypeEnum.enumValues)[number];
type IdentifierOrigin = (typeof identifierOriginEnum.enumValues)[number];

export interface NewProjectIdentifier {
  type: IdentifierType;
  value: string;
  origin: IdentifierOrigin;
  sourceUrl?: string;
}

export interface CreateProjectInput {
  name: string;
  city: string;
  developer?: string;
  slug?: string;
  identifiers?: NewProjectIdentifier[];
}

export async function ensureLocalUser(db: Database, displayName = "משתמש מקומי") {
  const [created] = await db.insert(users).values({ displayName, isLocal: true }).onConflictDoNothing().returning();
  if (created) return created;

  const [existing] = await db.select().from(users).where(eq(users.isLocal, true)).limit(1);
  if (!existing) throw new Error("Failed to create or find local user");
  return existing;
}

export async function createProject(db: Database, ownerId: string, input: CreateProjectInput) {
  const currentSlug = toProjectSlug(input.slug ?? input.name);

  return db.transaction(async (transaction) => {
    const [project] = await transaction
      .insert(projects)
      .values({
        ownerId,
        name: input.name.trim(),
        city: input.city.trim(),
        developer: input.developer?.trim() || null,
        currentSlug,
      })
      .returning();
    if (!project) throw new Error("Failed to create project");

    await transaction.insert(projectSlugs).values({ projectId: project.id, slug: currentSlug, isCurrent: true });

    const identifiers = (input.identifiers ?? []).filter((identifier) => identifier.value.trim());
    if (identifiers.length) {
      await transaction.insert(projectIdentifiers).values(
        identifiers.map((identifier) => ({
          projectId: project.id,
          type: identifier.type,
          value: identifier.value.trim(),
          origin: identifier.origin,
          sourceUrl: identifier.sourceUrl,
        })),
      );
    }

    await transaction.insert(auditEvents).values({
      projectId: project.id,
      actor: "user",
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      after: { name: project.name, city: project.city, developer: project.developer, slug: project.currentSlug },
    });

    return project;
  });
}

export async function listProjects(db: Database, ownerId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));
}

export async function findProjectBySlug(db: Database, ownerId: string, slug: string) {
  const [match] = await db
    .select({ project: projects, matchedSlug: projectSlugs.slug, isCurrentSlug: projectSlugs.isCurrent })
    .from(projectSlugs)
    .innerJoin(projects, eq(projects.id, projectSlugs.projectId))
    .where(and(eq(projectSlugs.slug, slug), eq(projects.ownerId, ownerId)))
    .limit(1);

  if (!match) return null;

  const identifiers = await db
    .select()
    .from(projectIdentifiers)
    .where(eq(projectIdentifiers.projectId, match.project.id))
    .orderBy(asc(projectIdentifiers.createdAt));

  return { ...match, identifiers };
}
