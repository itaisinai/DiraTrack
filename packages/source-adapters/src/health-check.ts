/**
 * Source Health Check Logic
 *
 * Performs health checks on sources using only official URLs.
 * Never sends project-specific or registrant data.
 */

import {
  type HealthCheckResult,
  type SourceCapability,
  errorCategoryFromHttpStatus,
  healthStatusFromHttpStatus,
  sanitizeErrorMessage,
  type SourceErrorCategory,
  type SourceHealthStatus,
} from "./source-health.ts";

/**
 * Performs a health check on a source
 *
 * Rules:
 * - Uses only the official URL
 * - Has strict timeout from source capability
 * - Never sends project-specific data
 * - Manual-only sources return manual-only status without making requests
 * - Converts 403/429/CAPTCHA/timeout to explicit states
 */
export async function checkSourceHealth(
  capability: SourceCapability,
  fetcher: typeof fetch = fetch,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // Manual-only sources don't get health checked
  if (capability.requiresManualAction || capability.mode === "manual") {
    return {
      status: "manual-only",
      errorCategory: null,
      errorMessage: null,
      checkedAt: new Date(),
      responseTimeMs: null,
    };
  }

  // User-upload sources don't have external URLs
  if (capability.mode === "user-upload" || !capability.officialUrl) {
    return {
      status: "not-checked",
      errorCategory: null,
      errorMessage: null,
      checkedAt: new Date(),
      responseTimeMs: null,
    };
  }

  try {
    // Make a simple HEAD or GET request to the official URL
    // Use HEAD when possible to minimize data transfer
    const response = await fetcher(capability.officialUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": "DiraTrack/0.1 health-check",
        Accept: "text/html,application/json",
      },
      signal: AbortSignal.timeout(capability.timeoutMs),
      redirect: "follow",
    });

    const responseTimeMs = Date.now() - startTime;
    const status = healthStatusFromHttpStatus(response.status);
    const errorCategory = errorCategoryFromHttpStatus(response.status);
    const errorMessage = errorCategory ? `HTTP ${response.status}` : null;

    return {
      status,
      errorCategory,
      errorMessage,
      checkedAt: new Date(),
      responseTimeMs,
    };
  } catch (error: unknown) {
    const responseTimeMs = Date.now() - startTime;

    // Determine error category from exception
    let errorCategory: SourceErrorCategory;
    let status: SourceHealthStatus;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("timeout") || message.includes("aborted")) {
        errorCategory = "timeout";
        status = "unavailable";
      } else if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("enotfound") ||
        message.includes("econnrefused")
      ) {
        errorCategory = "network-error";
        status = "unavailable";
      } else {
        errorCategory = "unknown";
        status = "unavailable";
      }
    } else {
      errorCategory = "unknown";
      status = "unavailable";
    }

    return {
      status,
      errorCategory,
      errorMessage: sanitizeErrorMessage(error),
      checkedAt: new Date(),
      responseTimeMs: responseTimeMs >= capability.timeoutMs ? null : responseTimeMs,
    };
  }
}

/**
 * Performs health checks on multiple sources in parallel
 *
 * One source failing does not block others.
 * Returns a map of source key to health check result.
 */
export async function checkMultipleSourcesHealth(
  capabilities: SourceCapability[],
  fetcher: typeof fetch = fetch,
): Promise<Map<string, HealthCheckResult>> {
  const results = await Promise.allSettled(
    capabilities.map(async (capability) => {
      const result = await checkSourceHealth(capability, fetcher);
      return { key: capability.key, result };
    }),
  );

  const healthMap = new Map<string, HealthCheckResult>();

  for (const promiseResult of results) {
    if (promiseResult.status === "fulfilled") {
      const { key, result } = promiseResult.value;
      healthMap.set(key, result);
    } else {
      // If the health check itself threw an unhandled error, record it
      // This should be rare since checkSourceHealth handles errors internally
      healthMap.set("unknown", {
        status: "unavailable",
        errorCategory: "unknown",
        errorMessage: sanitizeErrorMessage(promiseResult.reason),
        checkedAt: new Date(),
        responseTimeMs: null,
      });
    }
  }

  return healthMap;
}

/**
 * Determines if a source is operational for automatic discovery
 */
export function isSourceOperational(result: HealthCheckResult): boolean {
  return result.status === "healthy" || result.status === "degraded";
}

/**
 * Gets a human-readable recovery action for a health check result
 */
export function getRecoveryAction(
  result: HealthCheckResult,
  sourceName: string,
): string | null {
  switch (result.status) {
    case "healthy":
      return null;
    case "degraded":
      if (result.errorCategory === "rate-limit") {
        return "המקור מגביל גישה זמנית. נסה שוב מאוחר יותר או בצע חיפוש ידני.";
      }
      return "המקור פועל אך עם שגיאות. נסה שוב או בצע חיפוש ידני.";
    case "unavailable":
      if (result.errorCategory === "timeout") {
        return `${sourceName} לא הגיב בזמן. בדוק את החיבור לאינטרנט ונסה שוב.`;
      }
      if (result.errorCategory === "network-error") {
        return `לא ניתן להתחבר ל${sourceName}. בדוק את החיבור לאינטרנט.`;
      }
      return `${sourceName} אינו זמין כרגע. נסה שוב מאוחר יותר או בצע חיפוש ידני.`;
    case "manual-only":
      return `${sourceName} דורש פעולה ידנית. המערכת תציג הנחיות לחיפוש.`;
    case "not-checked":
      return null;
    default:
      return null;
  }
}
