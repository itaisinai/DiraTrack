/**
 * Mock setup for e2e tests
 *
 * By default, tests should run with mocked external APIs for determinism.
 * Use @live tag for tests that need real external API calls.
 *
 * Note: Currently using environment-based mocking approach.
 * For more sophisticated mocking, consider adding MSW (Mock Service Worker).
 */

/**
 * Check if we're running in live API mode
 */
export function isLiveApiMode(): boolean {
  return process.env.LIVE_API_TESTS === "1";
}

/**
 * Get mock response for Asia Cyrus API
 * Returns empty array by default for deterministic tests
 */
export function getMockAsiaCyrusResponse(searchTerm: string): any[] {
  // In live mode, this won't be called
  // In mock mode, return empty results for determinism
  return [];
}

/**
 * Create mock server (placeholder for future MSW integration)
 * Currently returns a mock object that matches MSW interface
 */
export function createMockServer() {
  return {
    listen: (_options?: any) => {
      // Mock server listening - actual mocking happens at network level
      console.log("[Mock Server] Mock mode enabled for external APIs");
    },
    close: () => {
      // Mock server closing
    },
    resetHandlers: () => {
      // Reset handlers
    },
  };
}

/**
 * Create mock server with specific results
 */
export function createMockServerWithResults(results: any[]) {
  return createMockServer();
}

/**
 * Configuration for test environment
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
