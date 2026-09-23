import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateURLStructure,
  validateIPv4,
  validateIPv6,
} from "../url-security";

describe("URL Security", () => {
  describe("validateURLStructure", () => {
    it("should accept valid HTTPS URLs", () => {
      const result = validateURLStructure("https://example.com/path");
      assert.equal(result.valid, true);
      assert.ok(result.url);
    });

    it("should reject HTTP URLs", () => {
      const result = validateURLStructure("http://example.com");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("HTTPS"));
    });

    it("should reject URLs with credentials", () => {
      const result = validateURLStructure("https://user:pass@example.com");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("משתמש"));
    });

    it("should reject non-standard ports", () => {
      const result = validateURLStructure("https://example.com:8080");
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("פורט"));
    });

    it("should accept standard HTTPS port 443", () => {
      const result = validateURLStructure("https://example.com:443/path");
      assert.equal(result.valid, true);
    });

    it("should reject invalid URLs", () => {
      const result = validateURLStructure("not-a-url");
      assert.equal(result.valid, false);
    });
  });

  describe("validateIPv4", () => {
    it("should accept public IPv4 addresses", () => {
      assert.equal(validateIPv4("8.8.8.8").valid, true);
      assert.equal(validateIPv4("1.1.1.1").valid, true);
      assert.equal(validateIPv4("142.250.185.78").valid, true); // Google
    });

    it("should reject loopback addresses", () => {
      const result = validateIPv4("127.0.0.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Loopback"));
    });

    it("should reject private network 10.x.x.x", () => {
      const result = validateIPv4("10.0.0.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Private"));
    });

    it("should reject private network 172.16.x.x", () => {
      const result = validateIPv4("172.16.0.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Private"));
    });

    it("should reject private network 192.168.x.x", () => {
      const result = validateIPv4("192.168.1.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Private"));
    });

    it("should reject link-local 169.254.x.x", () => {
      const result = validateIPv4("169.254.169.254");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("metadata") || result.blockedReason?.includes("Link-local"));
    });

    it("should reject multicast addresses", () => {
      const result = validateIPv4("224.0.0.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Multicast"));
    });

    it("should reject zero addresses", () => {
      const result = validateIPv4("0.0.0.0");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Zero"));
    });
  });

  describe("validateIPv6", () => {
    it("should accept public IPv6 addresses", () => {
      assert.equal(validateIPv6("2001:4860:4860::8888").valid, true); // Google DNS
      assert.equal(validateIPv6("2606:4700:4700::1111").valid, true); // Cloudflare DNS
    });

    it("should reject loopback ::1", () => {
      const result = validateIPv6("::1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("Loopback"));
    });

    it("should reject IPv4-mapped loopback", () => {
      const result = validateIPv6("::ffff:127.0.0.1");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("IPv4-mapped"));
    });

    it("should reject IPv4-mapped private addresses", () => {
      assert.equal(validateIPv6("::ffff:10.0.0.1").valid, false);
      assert.equal(validateIPv6("::ffff:172.16.0.1").valid, false);
      assert.equal(validateIPv6("::ffff:192.168.1.1").valid, false);
      assert.equal(validateIPv6("::ffff:169.254.169.254").valid, false);
    });

    it("should reject link-local fe80::/10 range", () => {
      assert.equal(validateIPv6("fe80::1").valid, false);
      assert.equal(validateIPv6("fe90::1").valid, false); // P1 case from review
      assert.equal(validateIPv6("febf::ffff").valid, false); // End of range
    });

    it("should accept public addresses just outside fe80::/10", () => {
      // fec0 is outside fe80::/10
      assert.equal(validateIPv6("fec0::1").valid, true);
    });

    it("should reject unique local fc00::/7 range", () => {
      assert.equal(validateIPv6("fc00::1").valid, false);
      assert.equal(validateIPv6("fc01::1").valid, false); // P1 case from review
      assert.equal(validateIPv6("fd00::1").valid, false);
      assert.equal(validateIPv6("fd12::1").valid, false); // P1 case from review
      assert.equal(validateIPv6("fdff::ffff").valid, false); // End of range
    });

    it("should accept public addresses just outside fc00::/7", () => {
      // fb00 is outside fc00::/7
      assert.equal(validateIPv6("fb00::1").valid, true);
    });

    it("should reject multicast ff00::", () => {
      assert.equal(validateIPv6("ff02::1").valid, false);
      assert.equal(validateIPv6("ff01::1").valid, false);
    });

    it("should reject AWS IPv6 metadata", () => {
      const result = validateIPv6("fd00:ec2::254");
      assert.equal(result.valid, false);
      assert.ok(result.blockedReason?.includes("metadata"));
    });

    it("should be case-insensitive", () => {
      assert.equal(validateIPv6("FE80::1").valid, false);
      assert.equal(validateIPv6("FC01::1").valid, false);
      assert.equal(validateIPv6("FD12::1").valid, false);
    });
  });
});
