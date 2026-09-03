import assert from "node:assert/strict";
import test from "node:test";
import { getDatabase } from "./index.ts";
import { createProject, ensureLocalUser } from "./projects.ts";

test("createProject generates unique slugs for duplicate names", async () => {
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  const projectName = `Test Project ${Date.now()}`;

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

  // First project should have the base slug
  assert.ok(!project1.currentSlug.match(/-[a-z0-9]{4}$/));

  // Second project should have a suffix
  assert.ok(project2.currentSlug.match(/-[a-z0-9]{4}$/));
});

test("createProject preserves readable slugs", async () => {
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  const uniqueName = `גני יהודה — הגרלה ${Date.now()}`;
  const project = await createProject(db, user.id, {
    name: uniqueName,
    city: "Tel Aviv",
  });

  // Check that the slug is readable (no suffix added on first creation)
  assert.ok(project.currentSlug.startsWith("גני-יהודה-הגרלה-"));
  assert.ok(!project.currentSlug.match(/-[a-z0-9]{4}$/));
});

test("createProject handles concurrent creation with same name", async () => {
  const db = getDatabase();
  const user = await ensureLocalUser(db);

  const projectName = `Concurrent Test ${Date.now()}`;

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
});
