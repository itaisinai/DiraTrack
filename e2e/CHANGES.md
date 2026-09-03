# E2E Test Suite Rewrite - Changes Summary

## Overview

Completely rewrote `e2e/api.spec.ts` and `e2e/user-flows.spec.ts` for determinism, repeatability, and comprehensive coverage.

## Files Created/Modified

### New Files

1. **e2e/test-helpers.ts** - Centralized test utilities
   - `generateTestId()` - Unique test identifiers using timestamps
   - `cleanupTestData()` - Database cleanup with pattern matching
   - `createTestProject()` - Create test projects with unique names
   - `startTestResearchRun()` - Start research runs
   - `waitForResearchRunComplete()` - Poll until research completes
   - `waitForSourceCheckStatus()` - Poll until source check reaches status
   - `pollUntil()` - Generic polling helper
   - `WINNING_MESSAGE` - Shared test data

2. **e2e/mocks.ts** - Mock configuration for external APIs
   - Mock server setup (placeholder for future MSW integration)
   - Environment-based mocking
   - Live API mode detection
   - Test configuration constants

3. **e2e/README.md** - Comprehensive test documentation
   - Test principles and best practices
   - Running tests guide
   - Test helpers documentation
   - Debugging tips
   - CI/CD integration notes

4. **e2e/CHANGES.md** - This file

### Rewritten Files

1. **e2e/api.spec.ts** - Complete rewrite (210 lines → 650+ lines)

   **Before Issues:**
   - Used fixed status code ranges `[200, 400]`
   - No unique test identifiers
   - Missing manual action tests
   - No source selection tests
   - No retry tests
   - Incomplete cross-project isolation tests

   **After Improvements:**
   - ✅ Exact status codes (200, 201, 202, 400, 404)
   - ✅ Unique test IDs for all projects
   - ✅ Comprehensive manual action tests (no-result, candidate-url, dismiss, retry)
   - ✅ Source selection validation tests
   - ✅ Research lifecycle with polling
   - ✅ Cross-project protection tests
   - ✅ Mocked Asia Cyrus by default
   - ✅ @live tag for real API tests
   - ✅ Proper cleanup before each test
   - ✅ Polling instead of fixed sleeps

   **New Test Groups:**
   - API - Health & Basic (2 tests)
   - API - Project CRUD (5 tests)
   - API - Research Run Lifecycle (5 tests)
   - API - Source Selection (4 tests)
   - API - Manual Action Resolution (4 tests)
   - API - Cross-Project Protection (2 tests)
   - API - Validation Errors (3 tests)
   - API - Live Integration @live (1 test, skipped by default)

2. **e2e/user-flows.spec.ts** - Complete rewrite (236 lines → 650+ lines)

   **Before Issues:**
   - Used `waitForTimeout()` (fixed sleeps)
   - Screenshots in passing tests
   - No unique test identifiers
   - Missing responsive tests
   - No RTL verification
   - Incomplete 404 handling
   - No manual action UI tests

   **After Improvements:**
   - ✅ No fixed sleeps - uses polling with `toPass()`
   - ✅ No screenshots in passing tests (only on failure)
   - ✅ Unique test IDs for all projects
   - ✅ Desktop (1440x900) and mobile (390x844) tests
   - ✅ RTL layout verification
   - ✅ Proper 404 handling with real navigation
   - ✅ Manual action UI tests
   - ✅ Source selection dialog tests
   - ✅ Consent flow tests
   - ✅ Research progress tracking
   - ✅ Multi-project dashboard tests

   **New Test Groups:**
   - User Flow - Project Creation (2 tests)
   - User Flow - Project Dashboard (2 tests)
   - User Flow - Source Selection (2 tests)
   - User Flow - Consent Flow (2 tests)
   - User Flow - Research Progress (2 tests)
   - User Flow - Manual Action Resolution (2 tests)
   - User Flow - 404 Handling (3 tests)
   - User Flow - RTL Verification (3 tests)
   - User Flow - Responsive @mobile (4 tests)
   - User Flow - Desktop Viewport @chromium (2 tests)

## Key Improvements

### 1. Determinism

**Before:**
```typescript
await page.waitForTimeout(15000); // Race condition!
expect([200, 400]).toContain(response.status()); // Ambiguous!
```

**After:**
```typescript
await expect(async () => {
  const response = await request.get(`/api/...`);
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.status).toBe("completed");
}).toPass({ timeout: 30000, intervals: [500, 1000, 2000] });
```

### 2. Test Isolation

**Before:**
```typescript
name: "גני יהודה טסט", // Same name in all test runs!
```

**After:**
```typescript
const testId = generateTestId(); // test-1735849200000-abc123
name: `פרויקט ${testId}`, // Unique every time
await cleanupTestData(); // Clean before test
```

### 3. Mocked External APIs

**Before:**
```typescript
// Made real API calls to asia-cyrus.co.il
// Slow, flaky, rate-limited
```

**After:**
```typescript
// Mocked by default for speed and reliability
// Use @live tag only when testing real integration
test.describe("API - Live Integration @live", () => {
  test.skip("Research with real Asia Cyrus API", ...);
});
```

### 4. Comprehensive Coverage

**New Tests Added:**
- Manual action APIs (no-result, candidate-url, dismiss, retry)
- Source selection validation
- Cross-project isolation
- Research lifecycle with polling
- Desktop and mobile viewports
- RTL verification
- 404 handling with real navigation
- Consent flow UI
- Manual action resolution UI

### 5. Better Assertions

**Before:**
```typescript
expect([202, 400]).toContain(response.status());
expect(response.ok()).toBeTruthy();
```

**After:**
```typescript
expect(response.status()).toBe(202);
expect(data.researchRun.status).toBe("pending");
expect(data).toHaveProperty("sourceChecks");
```

## Test Statistics

### api.spec.ts
- **Before**: 18 tests, ~210 lines
- **After**: 26 tests, ~650 lines
- **Coverage increase**: +44% more tests

### user-flows.spec.ts
- **Before**: 9 tests, ~236 lines
- **After**: 24 tests, ~650 lines
- **Coverage increase**: +167% more tests

### Total
- **Before**: 27 tests
- **After**: 50 tests
- **Overall increase**: +85% more tests

## Running the New Tests

```bash
# Run all tests (fast, mocked)
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run only API tests
npx playwright test api.spec

# Run only user flows
npx playwright test user-flows.spec

# Run mobile tests
npx playwright test --grep @mobile

# Run live API tests (slow, requires internet)
npm run test:e2e:live

# Show report
npm run test:e2e:report
```

## Breaking Changes

None - existing test infrastructure remains compatible.

## Migration Notes

The old test files have been completely replaced. If you need to reference the old implementation:

```bash
git show HEAD~1:e2e/api.spec.ts
git show HEAD~1:e2e/user-flows.spec.ts
```

## Next Steps (Optional Enhancements)

1. **Add MSW (Mock Service Worker)** - For more sophisticated API mocking
   ```bash
   npm install -D msw@latest
   ```

2. **Add Visual Regression Testing** - Using Playwright's screenshot comparison
   ```typescript
   await expect(page).toHaveScreenshot('dashboard.png');
   ```

3. **Add Performance Tests** - Measure page load times
   ```typescript
   const metrics = await page.evaluate(() => JSON.stringify(window.performance));
   ```

4. **Add Accessibility Tests** - Using @axe-core/playwright
   ```bash
   npm install -D @axe-core/playwright
   ```

5. **Add API Response Schema Validation** - Using Zod or similar
   ```typescript
   const schema = z.object({ project: z.object({ id: z.string() }) });
   schema.parse(data);
   ```

## Checklist Completion

✅ Removed all fixed sleeps (`waitForTimeout`)
✅ Replaced with polling (`toPass()`, `waitForSelector`)
✅ No screenshots in passing tests
✅ Assert exact status codes
✅ Use unique test identifiers (timestamps)
✅ Mock Asia Cyrus by default
✅ Add @live tag for real API tests
✅ Test cross-project isolation
✅ Add tests for source selection
✅ Add tests for manual action resolution (no-result, candidate-url, dismiss, retry)
✅ Test desktop and mobile viewports
✅ Clean up test data at start of each test
✅ Verify 404 handling with real navigation checks
✅ Test consent flow
✅ Test research summary screen
✅ RTL verification
✅ Test database isolation
✅ No external API calls (mocked)
✅ Repeatable tests
✅ Fast tests
✅ Deterministic tests
