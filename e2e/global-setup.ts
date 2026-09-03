import { execSync } from "child_process";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { projects } from "@diratrack/database";
import postgres from "postgres";
import { getTestDatabaseUrl } from "./test-database-guard";

config({ path: new URL("../.env", import.meta.url) });

async function globalSetup() {
  const testDbUrl = getTestDatabaseUrl(); // Validates it's a test database

  console.log("Running migrations on test database...");

  // NOTE: Migrations are already applied. Skipping drizzle-kit migrate.
  // If migrations are needed, run manually: npm run test:db:migrate
  console.log("Test database migrations already applied (skipping)");

  // Clean up any leftover test data from previous crashed runs
  console.log("Cleaning up test database before suite...");
  try {
    const client = postgres(testDbUrl);
    const db = drizzle(client);

    // Delete all projects (cascade will handle related records)
    await db.delete(projects);

    await client.end();
    console.log("Test database cleanup completed");
  } catch (error) {
    console.warn("Warning during pre-suite cleanup:", error);
    // Don't fail the suite if cleanup fails - might be empty database
  }
}

export default globalSetup;
