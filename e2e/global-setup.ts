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

  // Step 2: Ensure migrations are applied
  console.log("Checking test database schema...");
  const migrateClient = postgres(testDbUrl);
  try {
    // Check if the schema exists by querying a known table
    await migrateClient`SELECT 1 FROM projects LIMIT 1`;
    console.log("Test database schema verified");
  } catch (error) {
    console.error("FATAL: Test database schema missing. Run migrations manually:");
    console.error(`  DATABASE_URL=${testDbUrl} npm run db:migrate -w @diratrack/database`);
    throw error;
  } finally {
    await migrateClient.end();
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
