import { config } from "dotenv";
import pg from "pg";

config({ path: new URL("../.env", import.meta.url) });

async function globalTeardown() {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    console.warn("TEST_DATABASE_URL not set, skipping cleanup");
    return;
  }

  // Safety check: ensure we're using a test database
  if (!testDbUrl.includes("test")) {
    throw new Error(
      `Safety check failed: TEST_DATABASE_URL must contain "test" in the name. Got: ${testDbUrl}`
    );
  }

  console.log("Cleaning up test database...");

  const client = new pg.Client({ connectionString: testDbUrl });

  try {
    await client.connect();

    // Delete data in correct order to respect foreign key constraints
    // Start with leaf tables (no dependencies) and work backwards
    const tables = [
      "audit_events",
      "milestone_evidence",
      "milestones",
      "timeline_tracks",
      "analysis_proposals",
      "analysis_claims",
      "analyses",
      "document_pages",
      "project_documents",
      "documents",
      "findings",
      "source_checks",
      "research_jobs",
      "research_runs",
      "tasks",
      "project_sources",
      "project_identifiers",
      "project_slugs",
      "projects",
      "sources",
      "users",
    ];

    for (const table of tables) {
      await client.query(`DELETE FROM ${table}`);
    }

    console.log("Test database cleanup completed successfully");
  } catch (error) {
    console.error("Failed to clean up test database:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export default globalTeardown;
