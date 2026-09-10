import { parse } from "pg-connection-string";

/**
 * Safety guard for test database operations
 * Ensures destructive operations only run against test databases
 */
export function validateTestDatabaseUrl(connectionString: string | undefined): void {
  if (!connectionString) {
    throw new Error("Database connection string is required for test operations");
  }

  let config;
  try {
    config = parse(connectionString);
  } catch (error) {
    throw new Error("Invalid database connection string format");
  }

  const databaseName = config.database;

  if (!databaseName) {
    throw new Error("Database name not found in connection string");
  }

  // Validate database name is exactly 'diratrack_test' or explicitly documented CI test database
  const allowedTestDatabases = ["diratrack_test"];

  // Allow CI-specific test database names if CI environment variable is set
  if (process.env.CI) {
    allowedTestDatabases.push("diratrack_ci_test");
  }

  if (!allowedTestDatabases.includes(databaseName)) {
    throw new Error(
      `SAFETY GUARD: Refusing to run destructive test operations on database '${databaseName}'. ` +
      `Only test databases are allowed: ${allowedTestDatabases.join(", ")}. ` +
      `This prevents accidental deletion of development or production data.`
    );
  }

  // Never log the full connection string (contains credentials)
  console.log(`[Test Safety] Validated test database: ${databaseName}`);
}

/**
 * Get test database URL with validation
 */
export function getTestDatabaseUrl(): string {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    throw new Error(
      "TEST_DATABASE_URL environment variable is required for E2E tests. " +
      "Set it to: postgresql://diratrack:diratrack@localhost:5432/diratrack_test"
    );
  }

  validateTestDatabaseUrl(testDbUrl);
  return testDbUrl;
}
