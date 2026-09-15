/**
 * Source Health and Capability Model
 *
 * Defines the health states, capability metadata, and configuration for research sources.
 * This model is shared across adapters, database, API, and UI layers.
 */

/**
 * Health status of a source
 *
 * - healthy: Source is operational and responding normally
 * - degraded: Source is responding but with errors or delays
 * - unavailable: Source is not responding or returning errors
 * - manual-only: Source requires manual interaction (CAPTCHA, login, etc.)
 * - not-checked: Health status has not been determined yet
 */
export type SourceHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "manual-only"
  | "not-checked";

/**
 * Implementation mode of a source
 *
 * - automatic: Source makes external requests automatically (requires consent)
 * - manual: Source provides instructions for manual research
 * - user-upload: Source represents user-uploaded documents (no external requests)
 */
export type SourceImplementationMode =
  | "automatic"
  | "manual"
  | "user-upload";

/**
 * Category of error encountered during health check or discovery
 *
 * - timeout: Request timed out
 * - rate-limit: Source returned 429 or rate limit error
 * - access-denied: Source returned 403 or requires authentication
 * - captcha-required: Source requires CAPTCHA solving
 * - invalid-response: Source returned malformed or unexpected response
 * - network-error: Network connectivity issue
 * - unknown: Unclassified error
 */
export type SourceErrorCategory =
  | "timeout"
  | "rate-limit"
  | "access-denied"
  | "captcha-required"
  | "invalid-response"
  | "network-error"
  | "unknown";

/**
 * Retry policy for automatic sources
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Multiplier for exponential backoff (e.g., 2.0 for doubling) */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number;
  /** HTTP status codes that should not be retried */
  nonRetryableStatusCodes: number[];
}

/**
 * Default retry policy for automatic sources
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2.0,
  maxDelayMs: 10000,
  nonRetryableStatusCodes: [400, 401, 403, 404, 422],
};

/**
 * Source capability metadata
 *
 * Describes what a source can do and its current health status.
 */
export interface SourceCapability {
  /** Unique source key */
  key: string;
  /** Display name */
  name: string;
  /** Source category */
  category: "official" | "municipal" | "developer" | "private" | "user-upload";
  /** Implementation mode */
  mode: SourceImplementationMode;
  /** Whether this source sends project data externally (requires consent) */
  sendsExternalData: boolean;
  /** Whether manual action is always required */
  requiresManualAction: boolean;
  /** Official URL for the source */
  officialUrl: string | null;
  /** Adapter key (null for user-uploads) */
  adapterKey: string | null;
  /** Timeout in milliseconds for health checks and discovery */
  timeoutMs: number;
  /** Retry policy for automatic sources */
  retryPolicy: RetryPolicy | null;
  /** Current health status */
  healthStatus: SourceHealthStatus;
  /** Timestamp of last health check */
  lastHealthCheckAt: Date | null;
  /** Category of last error encountered */
  lastErrorCategory: SourceErrorCategory | null;
  /** Human-readable error message (without secrets or personal data) */
  lastErrorMessage: string | null;
}

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  status: SourceHealthStatus;
  errorCategory: SourceErrorCategory | null;
  errorMessage: string | null;
  checkedAt: Date;
  responseTimeMs: number | null;
}

/**
 * Creates a default source capability with sensible defaults
 */
export function createDefaultCapability(
  key: string,
  name: string,
  category: SourceCapability["category"],
  mode: SourceImplementationMode,
  officialUrl: string | null,
): SourceCapability {
  const isAutomatic = mode === "automatic";
  const isManual = mode === "manual";

  return {
    key,
    name,
    category,
    mode,
    sendsExternalData: isAutomatic,
    requiresManualAction: isManual,
    officialUrl,
    adapterKey: mode === "user-upload" ? null : key,
    timeoutMs: 20000, // 20 seconds default
    retryPolicy: isAutomatic ? DEFAULT_RETRY_POLICY : null,
    healthStatus: "not-checked",
    lastHealthCheckAt: null,
    lastErrorCategory: null,
    lastErrorMessage: null,
  };
}

/**
 * Sanitizes an error message to remove secrets and personal data
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove anything that looks like tokens, keys, or personal identifiers
    return error.message
      .replace(/\b[A-Za-z0-9+/]{20,}={0,2}\b/g, "[REDACTED]") // Base64 tokens
      .replace(/\b[0-9]{9}\b/g, "[ID]") // Israeli ID numbers
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, "[PHONE]") // Phone numbers
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]") // Bearer tokens
      .substring(0, 500); // Limit length
  }
  return String(error).substring(0, 500);
}

/**
 * Determines health status from an HTTP status code
 */
export function healthStatusFromHttpStatus(status: number): SourceHealthStatus {
  if (status >= 200 && status < 300) return "healthy";
  if (status === 429) return "degraded"; // Rate limited but may recover
  if (status === 403) return "manual-only"; // Access denied, likely needs manual action
  if (status >= 500) return "degraded"; // Server error, may be temporary
  return "unavailable";
}

/**
 * Determines error category from an HTTP status code
 */
export function errorCategoryFromHttpStatus(status: number): SourceErrorCategory | null {
  if (status >= 200 && status < 300) return null;
  if (status === 429) return "rate-limit";
  if (status === 403 || status === 401) return "access-denied";
  return "unknown";
}

/**
 * Calculates the delay for a retry attempt using exponential backoff
 */
export function calculateRetryDelay(
  attemptNumber: number,
  policy: RetryPolicy,
): number {
  const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Determines if an HTTP status code should be retried
 */
export function shouldRetryStatus(status: number, policy: RetryPolicy): boolean {
  return !policy.nonRetryableStatusCodes.includes(status);
}
