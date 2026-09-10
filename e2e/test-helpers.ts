import { expect, APIRequestContext } from "@playwright/test";
import { drizzle } from "drizzle-orm/postgres-js";
import { projects } from "@diratrack/database";
import { ilike, or } from "drizzle-orm";
import postgres from "postgres";
import { getTestDatabaseUrl } from "./test-database-guard";

/**
 * Generate a unique test identifier for this test run
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Shared test database connection - created once and reused
 * CRITICAL: Always uses TEST_DATABASE_URL, never DATABASE_URL
 */
let sharedTestClient: postgres.Sql | null = null;
let sharedTestDb: ReturnType<typeof drizzle> | null = null;

function getTestDatabase() {
  if (!sharedTestDb) {
    const testDbUrl = getTestDatabaseUrl(); // Validates it's a test database
    sharedTestClient = postgres(testDbUrl, { max: 10 }); // Pool with max 10 connections
    sharedTestDb = drizzle(sharedTestClient);
  }
  return sharedTestDb;
}

/**
 * Close the shared test database connection
 * Called automatically by global teardown
 */
export async function closeTestDatabase(): Promise<void> {
  if (sharedTestClient) {
    await sharedTestClient.end();
    sharedTestClient = null;
    sharedTestDb = null;
  }
}

/**
 * Clean up test data from the database
 * This should be called at the start of each test to ensure isolation
 */
export async function cleanupTestData(testIdPrefix?: string): Promise<void> {
  const db = getTestDatabase();

  // Build conditions for test projects
  const conditions = [
    ilike(projects.name, "%טסט%"),
    ilike(projects.name, "%test-%"),
    ilike(projects.name, "פרויקט מחקר%"),
    ilike(projects.name, "פרויקט ריק%"),
    ilike(projects.name, "פרויקט מקור%"),
    ilike(projects.name, "פרויקט ללא%"),
    ilike(projects.name, "פרויקט לביטול%"),
    ilike(projects.name, "פרויקט ממצא%"),
    ilike(projects.name, "פרויקט א%"),
    ilike(projects.name, "פרויקט ב%"),
    ilike(projects.name, "פרויקט בדיקה%"),
    ilike(projects.name, "פרויקט שני%"),
    ilike(projects.name, "גני יהודה%"),
    ilike(projects.name, "פרויקט כפול%"),
  ];

  if (testIdPrefix) {
    conditions.push(ilike(projects.name, `%${testIdPrefix}%`));
  }

  // Delete projects matching test patterns
  // Cascade will handle related records (research runs, findings, etc.)
  await db.delete(projects).where(or(...conditions));
}

/**
 * Poll an API endpoint until a condition is met
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 30000,
    interval = 500,
    timeoutMessage = "Polling timed out"
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Wait for a research run to reach a terminal state
 */
export async function waitForResearchRunComplete(
  request: APIRequestContext,
  projectSlug: string,
  runId: string,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect(async () => {
    const response = await request.get(
      `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${runId}`
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Terminal states
    expect(["completed", "completed-with-errors", "failed", "cancelled"]).toContain(
      data.researchRun.status
    );
  }).toPass({
    timeout: options.timeout ?? 30000,
    intervals: [500, 1000, 2000],
  });
}

/**
 * Wait for a source check to reach a specific status
 */
export async function waitForSourceCheckStatus(
  request: APIRequestContext,
  projectSlug: string,
  runId: string,
  checkId: string,
  expectedStatus: string | string[],
  options: { timeout?: number } = {}
): Promise<void> {
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

  await expect(async () => {
    const response = await request.get(
      `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${runId}`
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    const check = data.sourceChecks.find((c: any) => c.id === checkId);
    expect(check).toBeTruthy();
    expect(statuses).toContain(check.status);
  }).toPass({
    timeout: options.timeout ?? 30000,
    intervals: [500, 1000, 2000],
  });
}

/**
 * Create a test project with unique name
 */
export async function createTestProject(
  request: APIRequestContext,
  options: {
    name?: string;
    city?: string;
    developer?: string;
    identifiers?: Array<{ type: string; value: string; origin?: string }>;
    testId?: string;
  } = {}
): Promise<{ project: any }> {
  const testId = options.testId ?? generateTestId();

  // Ensure all identifiers have an origin field (required by API)
  const identifiers = (options.identifiers ?? []).map((id) => ({
    ...id,
    origin: id.origin ?? "manual",
  }));

  const response = await request.post("/api/projects", {
    data: {
      name: options.name ?? `פרויקט ${testId}`,
      city: options.city ?? "תל אביב",
      developer: options.developer ?? null,
      identifiers,
    },
  });

  expect(response.status()).toBe(201);
  return await response.json();
}

/**
 * Start a research run with specified sources
 */
export async function startTestResearchRun(
  request: APIRequestContext,
  projectSlug: string,
  options: {
    sourceKeys?: string[];
    externalDataConsent?: boolean;
  } = {}
): Promise<{ researchRun: any }> {
  const response = await request.post(
    `/api/projects/${encodeURIComponent(projectSlug)}/research-runs`,
    {
      data: {
        sourceKeys: options.sourceKeys ?? ["asia-cyrus"],
        externalDataConsent: options.externalDataConsent ?? true,
      },
    }
  );

  expect(response.status()).toBe(202);
  return await response.json();
}

export const WINNING_MESSAGE = `שלום רב,

ברכותינו. זכית בהגרלה לתור לבחירת דירה.

במסגרת תוכנית "דירה בהנחה" זכית בהגרלה מספר 2642 לפרויקט 324 של קבלן אסיה סיירוס פיתוח וייזום בע"מ
ביישוב יהוד
נקבע כי מקומך לבחירת דירה הוא 63. בהגרלה זו הוצעו 118 דירות.

מומלץ לעקוב אחר התקדמות הפרויקט באתר:
https://www.dira.moch.gov.il/ProjectsList`;

/**
 * Force a source check to fail deterministically for testing retry functionality
 * This directly updates the database state to simulate a failed check
 */
export async function forceSourceCheckToFail(
  request: APIRequestContext,
  projectSlug: string,
  runId: string,
  sourceKey: string
): Promise<{ checkId: string; error: string }> {
  // Import required database modules
  const { sourceChecks } = await import("@diratrack/database");
  const { eq } = await import("drizzle-orm");

  // Use the shared test database connection
  const db = getTestDatabase();

  // Get the research run details to find the source check
  const runResponse = await request.get(
    `/api/projects/${encodeURIComponent(projectSlug)}/research-runs/${runId}`
  );
  expect(runResponse.status()).toBe(200);
  const runData = await runResponse.json();

  const check = runData.sourceChecks.find((c: any) => c.source.key === sourceKey);
  expect(check).toBeTruthy();

  // Verify the check exists in the database
  const { sql } = await import("drizzle-orm");
  const existing = await db.select().from(sourceChecks).where(eq(sourceChecks.id, check.id));
  expect(existing.length).toBe(1);

  // Directly update the source check to failed state, regardless of current state
  // This simulates what failResearchJob does after the worker processed it
  const testError = "Test-induced failure for retry test";
  const now = new Date();

  const result = await db
    .update(sourceChecks)
    .set({
      status: "failed",
      error: testError,
      progress: 100,
      resultCount: 0, // Clear results since it "failed"
      completedAt: now,
    })
    .where(eq(sourceChecks.id, check.id))
    .returning();

  expect(result.length).toBe(1);
  expect(result[0].status).toBe("failed");

  // Small delay to ensure the update is visible across connections
  await new Promise(resolve => setTimeout(resolve, 200));

  return {
    checkId: check.id,
    error: testError,
  };
}
