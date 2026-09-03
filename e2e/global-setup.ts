import { execSync } from "child_process";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

async function globalSetup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl) {
    throw new Error("TEST_DATABASE_URL is not set in .env file");
  }

  // Safety check: ensure we're using a test database
  if (!testDbUrl.includes("test")) {
    throw new Error(
      `Safety check failed: TEST_DATABASE_URL must contain "test" in the name. Got: ${testDbUrl}`
    );
  }

  console.log("Running migrations on test database...");

  try {
    // Run migrations using drizzle-kit
    execSync("npm run test:db:migrate", {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    });

    console.log("Test database migrations completed successfully");
  } catch (error) {
    console.error("Failed to run test database migrations:", error);
    throw error;
  }
}

export default globalSetup;
