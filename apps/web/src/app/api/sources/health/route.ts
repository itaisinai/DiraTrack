import { getDatabase, sources } from "@diratrack/database";
import { checkMultipleSourcesHealth, getRecoveryAction, getSourceCapabilities } from "@diratrack/source-adapters";
import { NextResponse } from "next/server";

/**
 * GET /api/sources/health
 *
 * Returns health status for all sources.
 * Health checks use only official URLs and never send project data.
 * A failed source does not block others.
 */
export async function GET() {
  try {
    const db = getDatabase();

    // Get source capabilities from catalog
    const capabilities = getSourceCapabilities();

    // Perform health checks in parallel
    const healthResults = await checkMultipleSourcesHealth(capabilities);

    // Get last persisted health data from database
    const persistedHealth = await db
      .select({
        key: sources.key,
        healthStatus: sources.healthStatus,
        lastHealthCheckAt: sources.lastHealthCheckAt,
        lastErrorCategory: sources.lastErrorCategory,
        lastErrorMessage: sources.lastErrorMessage,
      })
      .from(sources);

    const persistedMap = new Map(
      persistedHealth.map((s) => [
        s.key,
        {
          healthStatus: s.healthStatus,
          lastHealthCheckAt: s.lastHealthCheckAt,
          lastErrorCategory: s.lastErrorCategory,
          lastErrorMessage: s.lastErrorMessage,
        },
      ]),
    );

    // Combine fresh health check results with capability metadata
    const sourcesWithHealth = capabilities.map((capability) => {
      const freshHealth = healthResults.get(capability.key);
      const persisted = persistedMap.get(capability.key);

      // Use fresh health if available, otherwise use persisted
      const currentHealth = freshHealth
        ? {
            healthStatus: freshHealth.status,
            lastHealthCheckAt: freshHealth.checkedAt,
            lastErrorCategory: freshHealth.errorCategory,
            lastErrorMessage: freshHealth.errorMessage,
          }
        : persisted ?? {
            healthStatus: capability.healthStatus,
            lastHealthCheckAt: capability.lastHealthCheckAt,
            lastErrorCategory: capability.lastErrorCategory,
            lastErrorMessage: capability.lastErrorMessage,
          };

      const recoveryAction = freshHealth
        ? getRecoveryAction(freshHealth, capability.name)
        : null;

      return {
        key: capability.key,
        name: capability.name,
        category: capability.category,
        mode: capability.mode,
        sendsExternalData: capability.sendsExternalData,
        requiresManualAction: capability.requiresManualAction,
        officialUrl: capability.officialUrl,
        healthStatus: currentHealth.healthStatus,
        lastHealthCheckAt: currentHealth.lastHealthCheckAt,
        lastErrorCategory: currentHealth.lastErrorCategory,
        lastErrorMessage: currentHealth.lastErrorMessage,
        recoveryAction,
      };
    });

    return NextResponse.json({ sources: sourcesWithHealth });
  } catch (error) {
    console.error("Source health check failed:", error);
    return NextResponse.json(
      { error: "Failed to check source health" },
      { status: 500 },
    );
  }
}
