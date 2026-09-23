import dns from "node:dns/promises";
import { URL } from "node:url";

/**
 * SSRF Protection: Validates URLs and resolved IPs before fetching
 *
 * Security requirements:
 * - HTTPS only
 * - No credentials in URL
 * - No private/loopback/link-local/multicast/reserved IPs (IPv4 and IPv6)
 * - No metadata service IPs (169.254.169.254, fd00:ec2::254)
 * - Validate every redirect destination
 */

const BLOCKED_IP_RANGES_V4 = [
  // Loopback
  { start: "127.0.0.0", end: "127.255.255.255", name: "Loopback" },
  // Private networks
  { start: "10.0.0.0", end: "10.255.255.255", name: "Private (10.0.0.0/8)" },
  { start: "172.16.0.0", end: "172.31.255.255", name: "Private (172.16.0.0/12)" },
  { start: "192.168.0.0", end: "192.168.255.255", name: "Private (192.168.0.0/16)" },
  // Link-local
  { start: "169.254.0.0", end: "169.254.255.255", name: "Link-local" },
  // Metadata services
  { start: "169.254.169.254", end: "169.254.169.254", name: "AWS metadata" },
  // Multicast
  { start: "224.0.0.0", end: "239.255.255.255", name: "Multicast" },
  // Reserved/Future
  { start: "240.0.0.0", end: "255.255.255.255", name: "Reserved" },
  // Zero/broadcast
  { start: "0.0.0.0", end: "0.255.255.255", name: "Zero" },
];

const BLOCKED_IPV6_PATTERNS = [
  { pattern: /^::1$/, name: "Loopback (::1)" },
  { pattern: /^::ffff:127\./i, name: "IPv4-mapped loopback" },
  { pattern: /^fe80:/i, name: "Link-local" },
  { pattern: /^fc00:/i, name: "Unique local (fc00::/7)" },
  { pattern: /^fd00:/i, name: "Unique local (fd00::/8)" },
  { pattern: /^ff[0-9a-f]{2}:/i, name: "Multicast" },
  { pattern: /^fd00:ec2::254$/i, name: "AWS metadata (IPv6)" },
];

export interface URLValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

export interface IPValidationResult {
  valid: boolean;
  error?: string;
  blockedReason?: string;
}

/**
 * Parse and validate URL structure and protocol
 */
export function validateURLStructure(urlString: string): URLValidationResult {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "https:") {
      return { valid: false, error: "רק כתובות HTTPS מותרות" };
    }

    if (url.username || url.password) {
      return { valid: false, error: "כתובת URL לא יכולה להכיל שם משתמש או סיסמה" };
    }

    if (!url.hostname) {
      return { valid: false, error: "כתובת URL חייבת לכלול שם מארח" };
    }

    // Reject non-standard ports unless explicitly allowed
    if (url.port && url.port !== "443") {
      return { valid: false, error: `פורט לא נתמך: ${url.port}` };
    }

    return { valid: true, url };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "כתובת URL לא תקינה",
    };
  }
}

/**
 * Convert IPv4 string to numeric value for range checking
 */
function ipv4ToNumber(ip: string): number {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  return (parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!;
}

/**
 * Check if IPv4 address is in blocked ranges
 */
export function validateIPv4(ip: string): IPValidationResult {
  const ipNum = ipv4ToNumber(ip);

  for (const range of BLOCKED_IP_RANGES_V4) {
    const startNum = ipv4ToNumber(range.start);
    const endNum = ipv4ToNumber(range.end);

    if (ipNum >= startNum && ipNum <= endNum) {
      return {
        valid: false,
        error: "כתובת IP פרטית או שמורה אינה מותרת",
        blockedReason: `${range.name} (${ip})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check if IPv6 address is in blocked patterns
 */
export function validateIPv6(ip: string): IPValidationResult {
  const normalized = ip.toLowerCase();

  for (const { pattern, name } of BLOCKED_IPV6_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        error: "כתובת IP פרטית או שמורה אינה מותרת",
        blockedReason: `${name} (${ip})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Resolve hostname and validate all resolved IPs
 */
export async function validateHostnameAndResolve(
  hostname: string
): Promise<{ valid: boolean; error?: string; ips?: string[] }> {
  try {
    // Resolve both A and AAAA records
    const addresses = await dns.resolve(hostname, "A").catch(() => [] as string[]);
    const addresses6 = await dns.resolve(hostname, "AAAA").catch(() => [] as string[]);

    const allIps = [...addresses, ...addresses6];

    if (allIps.length === 0) {
      return { valid: false, error: "לא ניתן לפתור את שם המארח" };
    }

    // Validate each resolved IP
    for (const ip of allIps) {
      const isV6 = ip.includes(":");
      const result = isV6 ? validateIPv6(ip) : validateIPv4(ip);

      if (!result.valid) {
        return {
          valid: false,
          error: result.error || "כתובת IP לא תקינה",
        };
      }
    }

    return { valid: true, ips: allIps };
  } catch (error) {
    return {
      valid: false,
      error: "שגיאה בפתרון שם המארח",
    };
  }
}

/**
 * Validate a URL completely: structure, hostname resolution, and IP validation
 */
export async function validateURLForFetch(
  urlString: string
): Promise<{ valid: boolean; error?: string; url?: URL }> {
  // 1. Validate URL structure
  const structureResult = validateURLStructure(urlString);
  if (!structureResult.valid || !structureResult.url) {
    return structureResult;
  }

  const url = structureResult.url;

  // 2. Resolve and validate hostname
  const hostnameResult = await validateHostnameAndResolve(url.hostname);
  if (!hostnameResult.valid) {
    return {
      valid: false,
      error: hostnameResult.error || "אימות שם מארח נכשל",
    };
  }

  return { valid: true, url };
}

/**
 * Validate redirect destination before following
 */
export async function validateRedirect(
  redirectUrl: string,
  redirectCount: number,
  maxRedirects: number
): Promise<{ valid: boolean; error?: string }> {
  if (redirectCount >= maxRedirects) {
    return { valid: false, error: `יותר מדי הפניות (מקסימום: ${maxRedirects})` };
  }

  const result = await validateURLForFetch(redirectUrl);
  if (!result.valid) {
    return { valid: false, error: `הפניה לכתובת לא חוקית: ${result.error}` };
  }

  return { valid: true };
}
