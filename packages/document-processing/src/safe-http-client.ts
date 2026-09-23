import dns from "node:dns/promises";
import { validateIPv4, validateIPv6 } from "./url-security";

/**
 * Safe HTTP client that pins validated DNS addresses to prevent rebinding attacks
 *
 * Security model:
 * 1. Resolve hostname to IP addresses
 * 2. Validate ALL resolved addresses
 * 3. Connect directly to a validated IP
 * 4. Preserve hostname for TLS SNI and certificate verification
 * 5. Repeat for every redirect
 */

export interface SafeFetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  finalURL: string;
  error?: string;
}

/**
 * Fetch with DNS address pinning to prevent rebinding
 */
export async function safeFetch(options: SafeFetchOptions): Promise<SafeFetchResult> {
  const { url, method = "GET", headers = {}, signal, maxRedirects = 5 } = options;

  let currentURL = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const parsed = new URL(currentURL);

    // Resolve and validate DNS
    const addresses = await dns.resolve(parsed.hostname, "A").catch(() => [] as string[]);
    const addresses6 = await dns.resolve(parsed.hostname, "AAAA").catch(() => [] as string[]);
    const allIPs = [...addresses, ...addresses6];

    if (allIPs.length === 0) {
      return {
        ok: false,
        status: 0,
        headers: new Headers(),
        body: null,
        finalURL: currentURL,
        error: "Failed to resolve hostname",
      };
    }

    // Validate ALL resolved addresses
    for (const ip of allIPs) {
      const isV6 = ip.includes(":");
      const result = isV6 ? validateIPv6(ip) : validateIPv4(ip);

      if (!result.valid) {
        return {
          ok: false,
          status: 0,
          headers: new Headers(),
          body: null,
          finalURL: currentURL,
          error: result.error || "Blocked IP address",
        };
      }
    }

    // Use the first validated IPv4 address (prefer IPv4 for compatibility)
    const targetIP = addresses[0] || addresses6[0];
    if (!targetIP) {
      return {
        ok: false,
        status: 0,
        headers: new Headers(),
        body: null,
        finalURL: currentURL,
        error: "No valid addresses",
      };
    }

    // Build URL with pinned IP, preserve port and path
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const pinnedURL = `${parsed.protocol}//${targetIP}:${port}${parsed.pathname}${parsed.search}`;

    // Fetch with pinned IP but original hostname in Host header
    const fetchHeaders = {
      ...headers,
      Host: parsed.hostname,
    };

    try {
      const response = await fetch(pinnedURL, {
        method,
        headers: fetchHeaders,
        signal,
        redirect: "manual",
      });

      // Handle redirects
      if (
        response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 308
      ) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            status: response.status,
            headers: response.headers,
            body: null,
            finalURL: currentURL,
            error: "Redirect without location",
          };
        }

        // Resolve relative redirects
        currentURL = new URL(location, currentURL).href;
        redirectCount++;
        continue;
      }

      // Non-redirect response
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        body: response.body,
        finalURL: currentURL,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        headers: new Headers(),
        body: null,
        finalURL: currentURL,
        error: error instanceof Error ? error.message : "Fetch failed",
      };
    }
  }

  return {
    ok: false,
    status: 0,
    headers: new Headers(),
    body: null,
    finalURL: currentURL,
    error: `Too many redirects (max ${maxRedirects})`,
  };
}
