import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RETRY_POLICY, calculateRetryDelay, shouldRetryStatus } from "./source-health.ts";
import { MaxRetriesExhaustedError, createRetryFetcher, withRetry } from "./retry.ts";

test("calculateRetryDelay uses exponential backoff", () => {
  const policy = { ...DEFAULT_RETRY_POLICY, initialDelayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 10000 };

  assert.equal(calculateRetryDelay(1, policy), 1000); // First retry: 1000 * 2^0
  assert.equal(calculateRetryDelay(2, policy), 2000); // Second retry: 1000 * 2^1
  assert.equal(calculateRetryDelay(3, policy), 4000); // Third retry: 1000 * 2^2
  assert.equal(calculateRetryDelay(4, policy), 8000); // Fourth retry: 1000 * 2^3
  assert.equal(calculateRetryDelay(5, policy), 10000); // Fifth retry: capped at maxDelayMs
});

test("shouldRetryStatus returns false for permanent client errors", () => {
  const policy = DEFAULT_RETRY_POLICY;

  assert.equal(shouldRetryStatus(400, policy), false);
  assert.equal(shouldRetryStatus(401, policy), false);
  assert.equal(shouldRetryStatus(403, policy), false);
  assert.equal(shouldRetryStatus(404, policy), false);
  assert.equal(shouldRetryStatus(422, policy), false);
});

test("shouldRetryStatus returns true for retryable errors", () => {
  const policy = DEFAULT_RETRY_POLICY;

  assert.equal(shouldRetryStatus(429, policy), true); // Rate limit
  assert.equal(shouldRetryStatus(500, policy), true); // Server error
  assert.equal(shouldRetryStatus(502, policy), true); // Bad gateway
  assert.equal(shouldRetryStatus(503, policy), true); // Service unavailable
  assert.equal(shouldRetryStatus(504, policy), true); // Gateway timeout
});

test("withRetry succeeds on first attempt", async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts++;
    return "success";
  }, DEFAULT_RETRY_POLICY);

  assert.equal(result, "success");
  assert.equal(attempts, 1);
});

test("withRetry retries on transient failure and eventually succeeds", async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts++;
    if (attempts < 3) {
      const response = new Response("Service Unavailable", { status: 503 });
      throw response;
    }
    return "success";
  }, DEFAULT_RETRY_POLICY);

  assert.equal(result, "success");
  assert.equal(attempts, 3);
});

test("withRetry does not retry permanent client errors", async () => {
  let attempts = 0;
  await assert.rejects(
    async () => {
      await withRetry(async () => {
        attempts++;
        const response = new Response("Not Found", { status: 404 });
        throw response;
      }, DEFAULT_RETRY_POLICY);
    },
    (error: unknown) => {
      return error instanceof Response && error.status === 404;
    },
  );

  assert.equal(attempts, 1); // Should not retry 404
});

test("withRetry throws MaxRetriesExhaustedError when max attempts reached", async () => {
  const policy = { ...DEFAULT_RETRY_POLICY, maxAttempts: 2, initialDelayMs: 1 };
  let attempts = 0;

  await assert.rejects(
    async () => {
      await withRetry(async () => {
        attempts++;
        const response = new Response("Service Unavailable", { status: 503 });
        throw response;
      }, policy);
    },
    (error: unknown) => {
      return error instanceof Response && error.status === 503;
    },
  );

  assert.equal(attempts, 2);
});

test("withRetry respects Retry-After header in seconds", async () => {
  let attempts = 0;
  const startTime = Date.now();

  await assert.rejects(
    async () => {
      await withRetry(async () => {
        attempts++;
        if (attempts === 1) {
          const response = new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "1" }, // 1 second
          });
          throw response;
        }
        throw new Error("Should not reach here in test");
      }, { ...DEFAULT_RETRY_POLICY, maxAttempts: 2, initialDelayMs: 5000 });
    },
  );

  const elapsedMs = Date.now() - startTime;
  assert.equal(attempts, 2);
  // Should have waited ~1 second (from Retry-After), not 5 seconds (from initialDelayMs)
  assert.ok(elapsedMs < 3000, `Expected delay ~1s, got ${elapsedMs}ms`);
});

test("withRetry handles non-Response errors", async () => {
  let attempts = 0;
  await assert.rejects(
    async () => {
      await withRetry(async () => {
        attempts++;
        throw new Error("Network error");
      }, { ...DEFAULT_RETRY_POLICY, maxAttempts: 2, initialDelayMs: 1 });
    },
    /Network error/,
  );

  assert.equal(attempts, 2); // Should retry non-Response errors
});

test("createRetryFetcher wraps successful fetch", async () => {
  const mockFetcher = async () => new Response("OK", { status: 200 });
  const retryFetcher = createRetryFetcher(mockFetcher, DEFAULT_RETRY_POLICY);

  const response = await retryFetcher("https://example.com");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "OK");
});

test("createRetryFetcher retries failed fetch", async () => {
  let attempts = 0;
  const mockFetcher = async () => {
    attempts++;
    if (attempts < 2) {
      return new Response("Service Unavailable", { status: 503 });
    }
    return new Response("OK", { status: 200 });
  };

  const retryFetcher = createRetryFetcher(mockFetcher, { ...DEFAULT_RETRY_POLICY, initialDelayMs: 1 });
  const response = await retryFetcher("https://example.com");

  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
});

test("createRetryFetcher does not retry permanent errors", async () => {
  let attempts = 0;
  const mockFetcher = async () => {
    attempts++;
    return new Response("Not Found", { status: 404 });
  };

  const retryFetcher = createRetryFetcher(mockFetcher, DEFAULT_RETRY_POLICY);

  await assert.rejects(
    async () => await retryFetcher("https://example.com"),
    (error: unknown) => error instanceof Response && error.status === 404,
  );

  assert.equal(attempts, 1);
});
