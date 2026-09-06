import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { createProject, ensureLocalUser } from "./projects.ts";
import { projects } from "./schema.ts";
import * as schema from "./schema.ts";
import { getTestDatabaseUrl } from "../../../e2e/test-database-guard.ts";

const { Pool } = pg;

function getTestDatabase() {
  const testDbUrl = getTestDatabaseUrl();
  const client = new Pool({ connectionString: testDbUrl });
  return { db: drizzle(client, { schema }), client };
}

test("createProject generates unique slugs for duplicate names", async () => {
  const { db, client } = getTestDatabase();

  try {
    const user = await ensureLocalUser(db);
    const projectName = `Test Project ${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const project1 = await createProject(db, user.id, {
      name: projectName,
      city: "Tel Aviv",
    });

    const project2 = await createProject(db, user.id, {
      name: projectName,
      city: "Tel Aviv",
    });

    // Slugs must be different
    assert.notEqual(project1.currentSlug, project2.currentSlug);

    // First project should have the base slug (unless it collided with a previous test)
    // Just verify they're both valid slugs
    assert.ok(project1.currentSlug);
    assert.ok(project2.currentSlug);

    // At least one should have a suffix (the second one)
    const hasSuffix1 = !!project1.currentSlug.match(/-[a-z0-9]{4}$/);
    const hasSuffix2 = !!project2.currentSlug.match(/-[a-z0-9]{4}$/);
    assert.ok(hasSuffix2 || (hasSuffix1 && hasSuffix2)); // Second must have suffix

    // Clean up
    await db.delete(projects).where(eq(projects.id, project1.id));
    await db.delete(projects).where(eq(projects.id, project2.id));
  } finally {
    await client.end();
  }
});

test("createProject preserves readable slugs", async () => {
  const { db, client } = getTestDatabase();

  try {
    const user = await ensureLocalUser(db);
    const uniqueName = `גני יהודה — הגרלה ${Date.now()}`;

    const project = await createProject(db, user.id, {
      name: uniqueName,
      city: "Tel Aviv",
    });

    // Check that the slug is readable (no suffix added on first creation)
    assert.ok(project.currentSlug.startsWith("גני-יהודה-הגרלה-"));
    assert.ok(!project.currentSlug.match(/-[a-z0-9]{4}$/));

    // Clean up
    await db.delete(projects).where(eq(projects.id, project.id));
  } finally {
    await client.end();
  }
});

test("createProject handles concurrent creation with same name", async () => {
  const { db, client } = getTestDatabase();

  try {
    const user = await ensureLocalUser(db);
    const projectName = `Concurrent Test ${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create 3 projects concurrently with the same name
    const results = await Promise.all([
      createProject(db, user.id, { name: projectName, city: "Tel Aviv" }),
      createProject(db, user.id, { name: projectName, city: "Tel Aviv" }),
      createProject(db, user.id, { name: projectName, city: "Tel Aviv" }),
    ]);

    // All should succeed
    assert.equal(results.length, 3);

    // All slugs should be unique
    const slugs = results.map((p) => p.currentSlug);
    const uniqueSlugs = new Set(slugs);
    assert.equal(uniqueSlugs.size, 3);

    // Clean up
    for (const project of results) {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  } finally {
    await client.end();
  }
});
