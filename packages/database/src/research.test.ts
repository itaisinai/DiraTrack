import assert from "node:assert/strict";
import test from "node:test";
import { startResearchRun, claimNextResearchJob, failResearchJob, retryFailedSource } from "./research.ts";
import { getDatabase, closeDatabase, sources, projectSources } from "./index.ts";
import { ensureLocalUser, createProject } from "./projects.ts";
import { eq } from "drizzle-orm";

test("an explicit empty source list never expands to all research sources", async () => {
  await assert.rejects(
    startResearchRun(null as never, "project-id", []),
    /No enabled research sources were selected/,
  );
});

test("retry attempt counting: claim increments, retry inherits", async (t) => {
  // Skip if TEST_DATABASE_URL is not set
  if (!process.env.TEST_DATABASE_URL) {
    t.skip("TEST_DATABASE_URL not set");
    return;
  }

  const db = getDatabase(process.env.TEST_DATABASE_URL);
  const testId = `retry-test-${Date.now()}`;

  try {
    // Setup: Create test user and project
    const user = await ensureLocalUser(db);
    const project = await createProject(db, user.id, {
      name: `Test Project ${testId}`,
      city: "Test City",
      developer: undefined,
      identifiers: [],
    });

    assert.ok(project, "Failed to create test project");

    const [source] = await db.insert(sources).values({
      key: `test-source-${testId}`,
      name: `Test Source ${testId}`,
      category: "official",
      baseUrl: null,
      adapterKey: "test-adapter",
    }).onConflictDoNothing().returning();

    assert.ok(source, "Failed to create test source");

    await db.insert(projectSources).values({
      projectId: project.id,
      sourceId: source.id,
    });

    // Start a research run
    const run = await startResearchRun(db, project.id, [source.key]);
    assert.ok(run, "Failed to start research run");
    assert.equal(run.sourceCount, 1, "Should have exactly one source");

    // First claim: attempts should go from 0 to 1
    const firstClaim = await claimNextResearchJob(db, "test-worker-1");
    assert.ok(firstClaim, "Failed to claim job on first attempt");
    assert.equal(firstClaim.attempts, 1, "First claim should have attempts = 1");
    assert.equal(firstClaim.status, "running", "First claim should be running");

    // Simulate failure
    await failResearchJob(db, firstClaim, new Error("Test failure"));

    // Retry: should create new job with inherited attempts = 1
    const retryCheck = await retryFailedSource(db, project.id, run.id, firstClaim.sourceCheckId!);
    assert.ok(retryCheck, "Failed to retry source");
    assert.equal(retryCheck.status, "pending", "Retry should reset check to pending");
    assert.equal(retryCheck.error, null, "Retry should clear error");

    // Second claim: attempts should go from 1 to 2
    const secondClaim = await claimNextResearchJob(db, "test-worker-2");
    assert.ok(secondClaim, "Failed to claim job on retry");
    assert.equal(secondClaim.attempts, 2, "Second claim should have attempts = 2");
    assert.equal(secondClaim.status, "running", "Second claim should be running");
    assert.equal(secondClaim.sourceCheckId, firstClaim.sourceCheckId, "Should be the same source check");

    // Verify: only 2 executions occurred, so attempts = 2 is correct
    assert.equal(secondClaim.attempts, 2, "Total attempts should be 2 after one retry");
  } finally {
    // Cleanup happens automatically via cascade delete on user
    await closeDatabase();
  }
});

test("retry audit event records correct attempt number", async (t) => {
  // Skip if TEST_DATABASE_URL is not set
  if (!process.env.TEST_DATABASE_URL) {
    t.skip("TEST_DATABASE_URL not set");
    return;
  }

  const db = getDatabase(process.env.TEST_DATABASE_URL);
  const testId = `audit-test-${Date.now()}`;

  try {
    // Setup: Create test user and project
    const user = await ensureLocalUser(db);
    const project = await createProject(db, user.id, {
      name: `Test Project ${testId}`,
      city: "Test City",
      developer: undefined,
      identifiers: [],
    });

    assert.ok(project, "Failed to create test project");

    const [source] = await db.insert(sources).values({
      key: `test-source-${testId}`,
      name: `Test Source ${testId}`,
      category: "official",
      baseUrl: null,
      adapterKey: "test-adapter",
    }).onConflictDoNothing().returning();

    assert.ok(source, "Failed to create test source");

    await db.insert(projectSources).values({
      projectId: project.id,
      sourceId: source.id,
    });

    // Start research run, claim, and fail
    const run = await startResearchRun(db, project.id, [source.key]);
    const firstClaim = await claimNextResearchJob(db, "test-worker");
    assert.ok(firstClaim, "Failed to claim job");
    await failResearchJob(db, firstClaim, new Error("Test failure"));

    // Retry and check audit event
    await retryFailedSource(db, project.id, run.id, firstClaim.sourceCheckId!, "test-user");

    // Verify audit event records retryAttemptNumber = 2 (since inherited attempts was 1)
    const { auditEvents } = await import("./schema.ts");
    const { and } = await import("drizzle-orm");

    const events = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.projectId, project.id),
          eq(auditEvents.action, "retry-failed-source"),
          eq(auditEvents.entityId, firstClaim.sourceCheckId!),
        ),
      );

    assert.equal(events.length, 1, "Should have exactly one retry audit event");
    assert.ok(events[0], "Audit event should exist");
    const metadata = events[0].metadata as Record<string, unknown>;
    assert.equal(metadata.retryAttemptNumber, 2, "Audit event should record retry as attempt 2");
  } finally {
    // Cleanup happens automatically via cascade delete on user
    await closeDatabase();
  }
});
