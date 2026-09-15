/**
 * Mock setup for E2E tests
 *
 * This module provides deterministic mocking of external APIs.
 * By default, all external API calls are blocked/mocked.
 * Use LIVE_API_TESTS=1 for tests that need real external calls (@live tag).
 */

/**
 * Check if we're running in live API mode
 */
export function isLiveApiMode(): boolean {
  return process.env.LIVE_API_TESTS === "1";
}

/**
 * Mock response for Asia Cyrus WordPress API
 * Returns realistic mock data for testing
 */
export function getMockAsiaCyrusResponse(searchTerm: string): any[] {
  // Return one mock result for Asia Cyrus searches
  return [
    {
      id: 12345,
      title: `דף פרויקט - ${searchTerm}`,
      url: "https://asia-cyrus.co.il/project/mock-project",
      type: "post",
      subtype: "our-work",
    },
  ];
}

/**
 * Create mock fetch function for testing
 * This intercepts all fetch calls and returns mock data
 */
export function createMockFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Block all external requests by default
    if (!isLiveApiMode()) {
      // Asia Cyrus WordPress API
      if (url.includes("asia-cyrus.co.il/wp-json/wp/v2/search")) {
        const urlObj = new URL(url);
        const searchTerm = urlObj.searchParams.get("search") || "";

        return new Response(JSON.stringify(getMockAsiaCyrusResponse(searchTerm)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Dira BeHanacha (should not make external calls - manual action only)
      if (url.includes("dira.moch.gov.il")) {
        throw new Error(
          `MOCK VIOLATION: Attempted external request to ${url}. ` +
          `Dira BeHanacha should use manual action, not external fetch.`
        );
      }

      // Block any other external requests
      if (url.startsWith("http://") || url.startsWith("https://")) {
        throw new Error(
          `MOCK VIOLATION: Attempted unmocked external request to ${url}. ` +
          `All external requests must be mocked. Set LIVE_API_TESTS=1 for live tests.`
        );
      }
    }

    // Pass through to real fetch in live mode or for localhost
    return fetch(input, init);
  };
}

/**
 * Create mock server (compatibility interface)
 * Returns object that matches MSW-style interface for test setup
 */
export function createMockServer() {
  // Set up global fetch mock
  const originalFetch = global.fetch;
  const mockFetch = createMockFetch();

  return {
    listen: (_options?: any) => {
      global.fetch = mockFetch as any;
      console.log("[Mock Server] Mock mode enabled - all external APIs mocked");
    },
    close: () => {
      global.fetch = originalFetch;
      console.log("[Mock Server] Mock mode disabled");
    },
    resetHandlers: () => {
      // No handlers to reset in this implementation
    },
  };
}

/**
 * Test configuration
 */
export const TEST_CONFIG = {
  // Timeout for API calls in tests
  apiTimeout: 30000,

  // Timeout for polling operations
  pollTimeout: 30000,

  // Poll interval
  pollInterval: 500,

  // Mock external APIs by default
  mockExternalApis: !isLiveApiMode(),
};
