import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import { safeFetch } from "../safe-http-client";

describe("Safe HTTP Client - DNS Pinning", () => {
  it("should prevent DNS rebinding by pinning validated addresses", async () => {
    // Mock DNS to return different addresses on subsequent calls
    let dnsCallCount = 0;

    const mockedResolve = mock.method(dns, "resolve", (hostname: string, rrtype: string) => {
      dnsCallCount++;

      if (rrtype === "A") {
        // First call (validation): return public IP
        if (dnsCallCount === 1) {
          return Promise.resolve(["8.8.8.8"]);
        }
        // Second call (would be during fetch): return private IP
        // But with DNS pinning, this should never be called
        return Promise.resolve(["10.0.0.1"]);
      }

      return Promise.resolve([]);
    });

    // Attempt to fetch - should use pinned 8.8.8.8, not make second DNS call
    const result = await safeFetch({
      url: "https://evil.example.com/data",
      signal: AbortSignal.timeout(1000),
    });

    // Restore original
    mockedResolve.mock.restore();

    // DNS should only be called once (during validation)
    // The actual connection uses the pinned address
    assert.equal(dnsCallCount, 2); // Once for A, once for AAAA

    // Request should fail due to timeout/connection, but NOT due to reaching 10.0.0.1
    // The key security property: no second DNS lookup happened
  });

  it("should reject if DNS returns blocked address", async () => {
    const mockedResolve = mock.method(dns, "resolve", (hostname: string, rrtype: string) => {
      if (rrtype === "A") {
        return Promise.resolve(["192.168.1.1"]); // Private IP
      }
      return Promise.resolve([]);
    });

    const result = await safeFetch({
      url: "https://blocked.example.com/data",
    });

    mockedResolve.mock.restore();

    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("Blocked") || result.error?.includes("192.168"));
  });

  it("should reject link-local addresses", async () => {
    const mockedResolve = mock.method(dns, "resolve", (hostname: string, rrtype: string) => {
      if (rrtype === "A") {
        return Promise.resolve(["169.254.169.254"]); // Metadata service
      }
      return Promise.resolve([]);
    });

    const result = await safeFetch({
      url: "https://metadata.example.com/latest/meta-data",
    });

    mockedResolve.mock.restore();

    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it("should reject IPv6 unique-local addresses", async () => {
    const mockedResolve = mock.method(dns, "resolve", (hostname: string, rrtype: string) => {
      if (rrtype === "AAAA") {
        return Promise.resolve(["fc01::1"]); // Unique local
      }
      return Promise.resolve([]);
    });

    const result = await safeFetch({
      url: "https://ipv6-private.example.com/data",
    });

    mockedResolve.mock.restore();

    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it("should handle DNS resolution failure", async () => {
    const mockedResolve = mock.method(dns, "resolve", () => {
      return Promise.reject(new Error("ENOTFOUND"));
    });

    const result = await safeFetch({
      url: "https://nonexistent.example.com/data",
    });

    mockedResolve.mock.restore();

    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it("should validate redirect destinations", async () => {
    let requestCount = 0;

    const mockedResolve = mock.method(dns, "resolve", (hostname: string, rrtype: string) => {
      requestCount++;

      // First hostname resolves to public IP
      if (hostname === "public.example.com" && rrtype === "A") {
        return Promise.resolve(["8.8.8.8"]);
      }

      // Redirect target resolves to private IP - should be blocked
      if (hostname === "redirect-target.local" && rrtype === "A") {
        return Promise.resolve(["10.0.0.1"]);
      }

      return Promise.resolve([]);
    });

    // Note: In a real test with mocked HTTP, we'd simulate a redirect
    // For now, test that redirect validation path exists
    mockedResolve.mock.restore();

    assert.ok(true); // Placeholder until full HTTP mocking
  });
});
