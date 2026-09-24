import dns from "node:dns/promises";
import { Dispatcher, Agent, request } from "undici";
import { validateIPv4, validateIPv6 } from "./url-security";

/**
 * Safe HTTP client with DNS pinning to prevent rebinding attacks
 *
 * Security model:
 * 1. Resolve hostname to IP addresses ONCE
 * 2. Validate ALL resolved addresses before connecting
 * 3. Use Undici Agent with custom connect.lookup to force validated IPs
 * 4. Preserve original hostname in URL for TLS SNI and certificate validation
 * 5. Handle redirects manually, revalidating each destination
 *
 * This prevents time-of-check-time-of-use attacks where an attacker's DNS:
 * - Returns a public IP during validation
 * - Returns a private/metadata IP during the actual fetch
 */

export interface SafeHTTPOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxRedirects?: number;
}

export interface SafeHTTPResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Dispatcher.ResponseData["body"];
}

export interface SafeHTTPResult {
  ok: boolean;
  response?: SafeHTTPResponse;
  finalURL?: string;
  error?: string;
}

/**
 * Resolve hostname and validate all returned addresses
 */
async function resolveAndValidate(
  hostname: string
): Promise<{ valid: boolean; addresses?: string[]; error?: string }> {
  try {
    // Resolve both A and AAAA records
    const ipv4Results = await dns.resolve(hostname, "A").catch(() => [] as string[]);
    const ipv6Results = await dns.resolve(hostname, "AAAA").catch(() => [] as string[]);
    const allAddresses = [...ipv4Results, ...ipv6Results];

    if (allAddresses.length === 0) {
      return { valid: false, error: "Failed to resolve hostname" };
    }

    // Validate EVERY resolved address - if any is blocked, reject all
    for (const addr of allAddresses) {
      const isIPv6 = addr.includes(":");
      const validation = isIPv6 ? validateIPv6(addr) : validateIPv4(addr);

      if (!validation.valid) {
        return {
          valid: false,
          error: `Blocked address ${addr}: ${validation.blockedReason || validation.error}`,
        };
      }
    }

    return { valid: true, addresses: allAddresses };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "DNS resolution failed",
    };
  }
}

/**
 * Perform a safe HTTP request with DNS pinning
 *
 * Uses Undici Agent with a custom lookup function that returns only
 * pre-validated addresses, preventing DNS rebinding between validation
 * and connection.
 */
export async function safeFetch(options: SafeHTTPOptions): Promise<SafeHTTPResult> {
  const { url, method = "GET", headers = {}, signal, maxRedirects = 5 } = options;

  let currentURL = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    let parsedURL: URL;
    try {
      parsedURL = new URL(currentURL);
    } catch {
      return { ok: false, error: "Invalid URL" };
    }

    // Resolve and validate DNS for this URL
    const dnsResult = await resolveAndValidate(parsedURL.hostname);
    if (!dnsResult.valid || !dnsResult.addresses) {
      return { ok: false, error: dnsResult.error };
    }

    // Create a dispatcher with custom lookup that returns our validated addresses
    const validatedAddresses = dnsResult.addresses;
    const agent = new Agent({
      connect: {
        // Custom lookup returns only pre-validated addresses
        lookup: (hostname, _options, callback) => {
          // Only allow lookups for the hostname we validated
          if (hostname !== parsedURL.hostname) {
            callback(new Error(`Unexpected hostname: ${hostname}`), "", 4);
            return;
          }

          // Prefer IPv4 for compatibility
          const ipv4 = validatedAddresses.find((addr) => !addr.includes(":"));
          const address = ipv4 || validatedAddresses[0];
          const family = address!.includes(":") ? 6 : 4;

          callback(null, address!, family);
        },
      },
    });

    try {
      const response = await request(currentURL, {
        method,
        headers,
        signal,
        dispatcher: agent,
        // Note: undici follows redirects by default, we rely on status code checking
      });

      // Check for redirects
      const statusCode = response.statusCode;
      if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
        const location = response.headers.location;

        if (!location) {
          await response.body.dump(); // Clean up response
          return { ok: false, error: "Redirect without Location header" };
        }

        // Resolve relative redirect
        try {
          currentURL = new URL(
            Array.isArray(location) ? location[0]! : location,
            currentURL
          ).href;
        } catch {
          await response.body.dump();
          return { ok: false, error: "Invalid redirect location" };
        }

        redirectCount++;
        await response.body.dump(); // Clean up before next iteration
        continue;
      }

      // Non-redirect response - return it
      const responseHeaders: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) {
          responseHeaders[key] = value;
        }
      }

      return {
        ok: statusCode >= 200 && statusCode < 300,
        response: {
          statusCode,
          headers: responseHeaders,
          body: response.body,
        },
        finalURL: currentURL,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }

  return { ok: false, error: `Too many redirects (max: ${maxRedirects})` };
}
