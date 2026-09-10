# E2E Test Suite

Completely rewritten test suite for DiraTrack with focus on determinism, repeatability, and comprehensive coverage.

## Key Principles

1. **No Fixed Sleeps**: All tests use polling with `toPass()` or `waitForSelector` instead of `waitForTimeout()`
2. **No Screenshots in Passing Tests**: Screenshots only captured on failure by Playwright config
3. **Exact Status Codes**: Assert exact codes (200, 201, 404), not ranges like [200, 400]
4. **Unique Test Identifiers**: Every test uses unique timestamps/UUIDs for data isolation
5. **Mocked External APIs**: Asia Cyrus and other external APIs mocked by default
6. **Test Isolation**: Each test cleans up its own data at start
7. **Deterministic**: Tests can run multiple times with same results

## Test Structure

### api.spec.ts

API endpoint testing with comprehensive coverage:

- **Health & Basic**: Health check, projects list
- **Project CRUD**: Create, read, validation errors
- **Research Run Lifecycle**: Start, monitor, cancel, complete
- **Source Selection**: Validate source keys, consent requirements
- **Manual Action Resolution**: no-result, candidate-url, dismiss, retry
- **Cross-Project Protection**: Verify isolation between projects
- **Validation Errors**: 404 handling, malformed requests
- **Live Integration** (@live tag): Real API tests (skipped by default)

### user-flows.spec.ts

User interface and workflow testing:

- **Project Creation**: Empty state, winning message parsing, unique names
- **Project Dashboard**: Multiple projects, navigation
- **Source Selection**: Dialog, source checkboxes
- **Consent Flow**: External source consent requirements
- **Research Progress**: Progress tracking, completion
- **Manual Action Resolution**: UI for manual actions
- **404 Handling**: Nonexistent projects, runs, findings
- **RTL Verification**: Right-to-left layout and Hebrew text
- **Responsive** (@mobile tag): Mobile viewport testing (390x844)
- **Desktop Viewport** (@chromium tag): Desktop layout (1440x900)

## Running Tests

```bash
# Run all tests (with mocked APIs)
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run only API tests
npx playwright test api.spec

# Run only user flow tests
npx playwright test user-flows.spec

# Run live tests with real APIs (slow, requires internet)
npm run test:e2e:live

# Run mobile tests only
npx playwright test --grep @mobile

# Show test report
npm run test:e2e:report
```

## Test Helpers

Located in `e2e/test-helpers.ts`:

- `generateTestId()`: Create unique test identifier
- `cleanupTestData()`: Clean test data from database
- `createTestProject()`: Create test project with unique name
- `startTestResearchRun()`: Start research run with sources
- `waitForResearchRunComplete()`: Poll until research completes
- `waitForSourceCheckStatus()`: Poll until source check reaches status
- `pollUntil()`: Generic polling helper

## Mocking

Located in `e2e/mocks.ts`:

- External APIs (Asia Cyrus) mocked by default
- Mock returns empty results for determinism
- Use `@live` tag for tests that need real APIs
- Set `LIVE_API_TESTS=1` to enable real APIs

## Test Database

Tests use a separate test database configured via `TEST_DATABASE_URL` environment variable:

- Database migrated in `global-setup.ts`
- Each test cleans up its own data at start
- Test database must have "test" in its name (safety check)
- Use `npm run test:db:reset` to completely reset test database

## Best Practices

### DO

✅ Use unique test identifiers for all data
✅ Clean up test data at start of each test
✅ Use polling with `toPass()` for async operations
✅ Assert exact status codes
✅ Use semantic selectors (role, label)
✅ Test both desktop and mobile viewports
✅ Verify RTL layout for Hebrew content
✅ Test manual action workflows
✅ Test cross-project isolation

### DON'T

❌ Use `waitForTimeout()` or `sleep()`
❌ Take screenshots in passing tests
❌ Use ranges for status codes like [200, 400]
❌ Reuse project names between tests
❌ Make real external API calls in default tests
❌ Skip cleanup at test start
❌ Use relative waits without conditions
❌ Test against shared/production data

## Adding New Tests

1. Import test helpers at top of file
2. Add `beforeEach` hook to call `cleanupTestData()`
3. Use `generateTestId()` for unique data
4. Use polling helpers instead of fixed sleeps
5. Mock external APIs by default
6. Add `@live` tag only if real APIs required
7. Test both success and error cases
8. Verify cross-project isolation if relevant

Example:

```typescript
test("My new test", async ({ request }) => {
  const testId = generateTestId();

  const { project } = await createTestProject(request, {
    name: `Test Project ${testId}`,
    testId,
  });

  // Use polling instead of sleep
  await expect(async () => {
    const response = await request.get(`/api/projects/${project.currentSlug}`);
    expect(response.status()).toBe(200);
  }).toPass({ timeout: 10000 });
});
```

## Debugging

- Use `--debug` flag to run in debug mode
- Use `--ui` flag to see test runner UI
- Screenshots/videos captured on failure
- Check `test-results/` directory for artifacts
- Use `page.pause()` to debug specific point
- Check console logs for worker activity

## CI/CD Integration

- Tests run in CI with retries (configured in playwright.config.ts)
- Only @live tests skipped by default
- Test database must be available
- Environment variables required: TEST_DATABASE_URL
- Screenshots and videos uploaded as artifacts on failure
