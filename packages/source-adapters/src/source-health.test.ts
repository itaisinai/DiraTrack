import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCapability,
  errorCategoryFromHttpStatus,
  healthStatusFromHttpStatus,
  sanitizeErrorMessage,
} from "./source-health.ts";

test("sanitizeErrorMessage removes Base64 tokens", () => {
  const error = new Error("Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 should be hidden");
  const sanitized = sanitizeErrorMessage(error);

  assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
  assert.ok(sanitized.includes("[REDACTED]"));
});

test("sanitizeErrorMessage removes Israeli ID numbers", () => {
  const error = new Error("ID 123456789 found in error");
  const sanitized = sanitizeErrorMessage(error);

  assert.ok(!sanitized.includes("123456789"));
  assert.ok(sanitized.includes("[ID]"));
});

test("sanitizeErrorMessage removes phone numbers", () => {
  const error = new Error("Contact: 050-123-4567 for support");
  const sanitized = sanitizeErrorMessage(error);

  assert.ok(!sanitized.includes("050-123-4567"));
  assert.ok(sanitized.includes("[PHONE]"));
});

test("sanitizeErrorMessage removes Bearer tokens", () => {
  const error = new Error("Authorization: Bearer abc123def456 failed");
  const sanitized = sanitizeErrorMessage(error);

  assert.ok(!sanitized.includes("Bearer abc123def456"));
  assert.ok(sanitized.includes("Bearer [REDACTED]"));
});

test("sanitizeErrorMessage limits message length", () => {
  const longMessage = "a".repeat(1000);
  const error = new Error(longMessage);
  const sanitized = sanitizeErrorMessage(error);

  assert.ok(sanitized.length <= 500);
});

test("sanitizeErrorMessage handles non-Error objects", () => {
  const sanitized = sanitizeErrorMessage("Simple string error");
  assert.equal(sanitized, "Simple string error");
});

test("healthStatusFromHttpStatus returns healthy for 2xx", () => {
  assert.equal(healthStatusFromHttpStatus(200), "healthy");
  assert.equal(healthStatusFromHttpStatus(201), "healthy");
  assert.equal(healthStatusFromHttpStatus(204), "healthy");
});

test("healthStatusFromHttpStatus returns degraded for rate limits", () => {
  assert.equal(healthStatusFromHttpStatus(429), "degraded");
});

test("healthStatusFromHttpStatus returns manual-only for access denied", () => {
  assert.equal(healthStatusFromHttpStatus(403), "manual-only");
});

test("healthStatusFromHttpStatus returns degraded for server errors", () => {
  assert.equal(healthStatusFromHttpStatus(500), "degraded");
  assert.equal(healthStatusFromHttpStatus(502), "degraded");
  assert.equal(healthStatusFromHttpStatus(503), "degraded");
});

test("healthStatusFromHttpStatus returns unavailable for other errors", () => {
  assert.equal(healthStatusFromHttpStatus(404), "unavailable");
  assert.equal(healthStatusFromHttpStatus(400), "unavailable");
});

test("errorCategoryFromHttpStatus returns null for success", () => {
  assert.equal(errorCategoryFromHttpStatus(200), null);
  assert.equal(errorCategoryFromHttpStatus(201), null);
});

test("errorCategoryFromHttpStatus returns rate-limit for 429", () => {
  assert.equal(errorCategoryFromHttpStatus(429), "rate-limit");
});

test("errorCategoryFromHttpStatus returns access-denied for 403/401", () => {
  assert.equal(errorCategoryFromHttpStatus(403), "access-denied");
  assert.equal(errorCategoryFromHttpStatus(401), "access-denied");
});

test("errorCategoryFromHttpStatus returns unknown for other errors", () => {
  assert.equal(errorCategoryFromHttpStatus(500), "unknown");
  assert.equal(errorCategoryFromHttpStatus(404), "unknown");
});

test("createDefaultCapability builds automatic source capability", () => {
  const capability = createDefaultCapability(
    "test-source",
    "Test Source",
    "developer",
    "automatic",
    "https://example.com",
  );

  assert.equal(capability.key, "test-source");
  assert.equal(capability.name, "Test Source");
  assert.equal(capability.category, "developer");
  assert.equal(capability.mode, "automatic");
  assert.equal(capability.sendsExternalData, true);
  assert.equal(capability.requiresManualAction, false);
  assert.equal(capability.officialUrl, "https://example.com");
  assert.equal(capability.adapterKey, "test-source");
  assert.equal(capability.timeoutMs, 20000);
  assert.ok(capability.retryPolicy !== null);
  assert.equal(capability.healthStatus, "not-checked");
});

test("createDefaultCapability builds manual source capability", () => {
  const capability = createDefaultCapability(
    "test-manual",
    "Test Manual",
    "official",
    "manual",
    "https://example.gov.il",
  );

  assert.equal(capability.mode, "manual");
  assert.equal(capability.sendsExternalData, false);
  assert.equal(capability.requiresManualAction, true);
  assert.equal(capability.retryPolicy, null); // Manual sources don't retry
});

test("createDefaultCapability builds user-upload capability", () => {
  const capability = createDefaultCapability(
    "user-uploads",
    "User Uploads",
    "user-upload",
    "user-upload",
    null,
  );

  assert.equal(capability.mode, "user-upload");
  assert.equal(capability.sendsExternalData, false);
  assert.equal(capability.requiresManualAction, false);
  assert.equal(capability.adapterKey, null);
  assert.equal(capability.retryPolicy, null);
});
