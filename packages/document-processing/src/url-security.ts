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
  { pattern: /^::$/i, name: "Unspecified (::)" },
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
 * Parse IPv6 address into 16 bytes
 */
function parseIPv6ToBytes(ip: string): Buffer | null {
  try {
    const normalized = ip.toLowerCase();

    // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
    const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (ipv4MappedMatch) {
      const ipv4Part = ipv4MappedMatch[1];
      const ipv4Bytes = ipv4Part!.split('.').map(p => Number.parseInt(p, 10));
      return Buffer.from([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff,
        ipv4Bytes[0]!, ipv4Bytes[1]!, ipv4Bytes[2]!, ipv4Bytes[3]!
      ]);
    }

    // Expand :: notation
    const parts = normalized.split(':');
    const doubleColonIndex = parts.indexOf('');

    let hextets: number[] = [];

    if (doubleColonIndex !== -1) {
      // Has :: compression
      const leftParts = parts.slice(0, doubleColonIndex).filter(p => p !== '');
      const rightParts = parts.slice(doubleColonIndex + 1).filter(p => p !== '');
      const zeroCount = 8 - leftParts.length - rightParts.length;

      hextets = [
        ...leftParts.map(p => Number.parseInt(p, 16)),
        ...Array(zeroCount).fill(0),
        ...rightParts.map(p => Number.parseInt(p, 16))
      ];
    } else {
      // No compression
      hextets = parts.map(p => Number.parseInt(p, 16));
    }

    if (hextets.length !== 8) return null;

    // Convert to 16 bytes
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 8; i++) {
      bytes[i * 2] = (hextets[i]! >> 8) & 0xff;
      bytes[i * 2 + 1] = hextets[i]! & 0xff;
    }

    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

/**
 * Check if IPv6 address matches a CIDR prefix
 */
function matchesIPv6CIDR(ipBytes: Buffer, cidr: string): boolean {
  const [prefix, prefixLenStr] = cidr.split('/');
  const prefixLen = Number.parseInt(prefixLenStr!, 10);
  const prefixBytes = parseIPv6ToBytes(prefix!);

  if (!prefixBytes) return false;

  // Compare the prefix bits
  const fullBytes = Math.floor(prefixLen / 8);
  const remainingBits = prefixLen % 8;

  // Check full bytes
  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== prefixBytes[i]) return false;
  }

  // Check remaining bits
  if (remainingBits > 0) {
    const mask = (0xff << (8 - remainingBits)) & 0xff;
    if ((ipBytes[fullBytes]! & mask) !== (prefixBytes[fullBytes]! & mask)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if IPv6 address is in blocked patterns
 */
export function validateIPv6(ip: string): IPValidationResult {
  const normalized = ip.toLowerCase();
  const ipBytes = parseIPv6ToBytes(normalized);

  if (!ipBytes) {
    return {
      valid: false,
      error: "כתובת IPv6 לא תקינה",
      blockedReason: "Invalid format",
    };
  }

  // Check regex patterns first
  for (const { pattern, name } of BLOCKED_IPV6_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        error: "כתובת IP פרטית או שמורה אינה מותרת",
        blockedReason: `${name} (${ip})`,
      };
    }
  }

  // Check CIDR ranges
  // Unique local addresses: fc00::/7 (includes fc00:: through fdff::)
  if (matchesIPv6CIDR(ipBytes, 'fc00::/7')) {
    return {
      valid: false,
      error: "כתובת IP פרטית או שמורה אינה מותרת",
      blockedReason: `Unique local fc00::/7 (${ip})`,
    };
  }

  // Link-local: fe80::/10 (includes fe80:: through febf::)
  if (matchesIPv6CIDR(ipBytes, 'fe80::/10')) {
    return {
      valid: false,
      error: "כתובת IP פרטית או שמורה אינה מותרת",
      blockedReason: `Link-local fe80::/10 (${ip})`,
    };
  }

  // Check IPv4-mapped addresses for private IPv4
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.substring(7);
    const ipv4Result = validateIPv4(ipv4Part);
    if (!ipv4Result.valid) {
      return {
        valid: false,
        error: "כתובת IP פרטית או שמורה אינה מותרת",
        blockedReason: `IPv4-mapped private ${ipv4Result.blockedReason}`,
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
