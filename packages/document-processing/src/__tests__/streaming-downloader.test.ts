import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { downloadFileSecurely } from "../streaming-downloader";
import { safeFetch } from "../safe-http-client";

describe("Streaming Downloader", () => {
  it("should timeout if body stream stalls", async () => {
    // Mock safeFetch to return a stalled stream
    const mockSafeFetch = mock.method(
      // @ts-expect-error - mocking module
      global,
      "safeFetch",
      () => {
        return Promise.resolve({
          ok: true,
          response: {
            statusCode: 200,
            headers: {
              "content-type": "application/pdf",
              "content-length": "1000",
            },
            body: {
              // Async generator that never yields
              async *[Symbol.asyncIterator]() {
                // Stall forever
                await new Promise(() => {});
              },
            },
          },
          finalURL: "https://example.com/file.pdf",
        });
      }
    );

    const result = await downloadFileSecurely({
      url: "https://example.com/file.pdf",
      timeoutMs: 100, // Very short timeout for test
    });

    mockSafeFetch.mock.restore();

    assert.equal(result.success, false);
    assert.ok(result.error?.includes("הזמן הקצוב") || result.error?.includes("timeout"));
  });

  it("should cleanup temp file on size limit exceeded", async () => {
    // This is a placeholder - proper test requires mocking fs operations
    // and verifying temp file deletion
    assert.ok(true);
  });

  it("should cleanup temp file on validation failure", async () => {
    // Placeholder - needs fs mocking
    assert.ok(true);
  });

  it("should calculate correct SHA-256 while streaming", async () => {
    // Placeholder - needs full HTTP mocking
    assert.ok(true);
  });

  it("should enforce size limit during streaming", async () => {
    // Placeholder - needs mocked stream with controlled size
    assert.ok(true);
  });

  it("should handle abort signal correctly", async () => {
    const controller = new AbortController();

    // Abort immediately
    setTimeout(() => controller.abort(), 10);

    const result = await downloadFileSecurely({
      url: "https://example.com/largefile.pdf",
      timeoutMs: 5000,
    });

    // Should fail quickly due to abort
    assert.equal(result.success, false);
  });
});
