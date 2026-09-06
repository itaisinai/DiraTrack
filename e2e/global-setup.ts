import { execSync } from "child_process";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { projects } from "@diratrack/database";
import postgres from "postgres";
import { getTestDatabaseUrl } from "./test-database-guard";

config({ path: new URL("../.env", import.meta.url) });

async function globalSetup() {
  // Step 1: Validate TEST_DATABASE_URL
  const testDbUrl = getTestDatabaseUrl(); // Validates it's a test database

  // Step 2: ALWAYS run migrations (drizzle-kit migrate is idempotent)
  console.log("Running migrations on test database...");
  try {
    execSync("npm run test:db:migrate", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
  } catch (migrationError) {
    console.error("FATAL: Failed to run migrations on test database");
    throw migrationError; // Fail the suite if migrations fail
  }

  // Step 3: Clean up any leftover test data from previous crashed runs
  console.log("Cleaning up test database before suite...");
  const cleanupClient = postgres(testDbUrl);
  try {
    const cleanupDb = drizzle(cleanupClient);
    // Delete all projects (cascade will handle related records)
    await cleanupDb.delete(projects);
    console.log("Test database cleanup completed");
  } catch (error) {
    console.error("FATAL: Failed to cleanup test database");
    throw error; // Fail the suite if cleanup fails
  } finally {
    await cleanupClient.end();
  }
}

export default globalSetup;
