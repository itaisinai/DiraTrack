/**
 * Retry Logic with Exponential Backoff
 *
 * Implements retry wrapper for automatic source adapters.
 * Respects RetryPolicy configuration and Retry-After headers.
 */

import { type RetryPolicy, calculateRetryDelay, shouldRetryStatus } from "./source-health.ts";

/**
 * Error thrown when max retry attempts are exhausted
 */
export class MaxRetriesExhaustedError extends Error {
  readonly attempts: number;
  readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    super(`Max retry attempts (${attempts}) exhausted`);
    this.name = "MaxRetriesExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Result of a retry attempt
 */
interface RetryAttemptResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
  shouldRetry: boolean;
  retryAfterMs?: number;
}

/**
 * Extracts Retry-After header value in milliseconds
 * Supports both delay-seconds and HTTP-date formats
 */
function parseRetryAfter(response: Response): number | null {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return null;

  // Try parsing as seconds (integer)
  const seconds = Number.parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  try {
    const date = new Date(retryAfter);
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : null;
  } catch {
    return null;
  }
}

/**
 * Evaluates whether an error should be retried
 */
function evaluateRetry<T>(
  error: unknown,
  attempt: number,
  policy: RetryPolicy,
): RetryAttemptResult<T> {
  // If it's a Response (from fetch), check status code
  if (error instanceof Response) {
    const shouldRetry = shouldRetryStatus(error.status, policy);
    const retryAfterMs = shouldRetry ? (parseRetryAfter(error) ?? undefined) : undefined;

    return {
      success: false,
      error,
      shouldRetry: shouldRetry && attempt < policy.maxAttempts,
      retryAfterMs,
    };
  }

  // For other errors (timeout, network, etc.), retry if under max attempts
  return {
    success: false,
    error,
    shouldRetry: attempt < policy.maxAttempts,
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async function with retry logic using exponential backoff
 *
 * @param fn - The function to retry
 * @param policy - Retry policy configuration
 * @returns Result of successful execution or throws MaxRetriesExhaustedError
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const response = await fetch(url);
 *     if (!response.ok) throw response;
 *     return response.json();
 *   },
 *   capability.retryPolicy!
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error: unknown) {
      lastError = error;
      const evaluation = evaluateRetry<T>(error, attempt, policy);

      if (!evaluation.shouldRetry) {
        // Don't retry - either max attempts or non-retryable error
        throw error;
      }

      if (attempt < policy.maxAttempts) {
        // Calculate delay (prefer Retry-After if available)
        const delay = evaluation.retryAfterMs ?? calculateRetryDelay(attempt, policy);
        await sleep(delay);
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new MaxRetriesExhaustedError(policy.maxAttempts, lastError);
}

/**
 * Creates a retry-wrapped version of a fetch function
 *
 * @param fetcher - The fetch function to wrap
 * @param policy - Retry policy configuration
 * @returns Wrapped fetch function with retry logic
 *
 * @example
 * ```typescript
 * class MyAdapter {
 *   private readonly fetcher: Fetcher;
 *
 *   constructor(fetcher: Fetcher, retryPolicy: RetryPolicy) {
 *     this.fetcher = createRetryFetcher(fetcher, retryPolicy);
 *   }
 *
 *   async discover(context: SourceResearchContext) {
 *     // This fetch will automatically retry on transient failures
 *     const response = await this.fetcher(url, options);
 *     ...
 *   }
 * }
 * ```
 */
export function createRetryFetcher(
  fetcher: typeof fetch,
  policy: RetryPolicy,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    return withRetry(async () => {
      const response = await fetcher(input, init);
      if (!response.ok) {
        throw response; // Will be caught and evaluated for retry
      }
      return response;
    }, policy);
  };
}
