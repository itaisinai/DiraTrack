# Complete Milestones 0 & 1: Test Infrastructure and Research Lifecycle

This PR implements the complete research lifecycle infrastructure including test database isolation, manual action resolution, source selection, findings collection, research summary screens, and deterministic retry-attempt accounting as defined in Milestones 0 and 1 of the product roadmap.

## 🎯 Milestones Completed

### ✅ Milestone 0: Stabilization
- Test database infrastructure with safety guards and connection pooling
- Playwright global setup/teardown with automatic migrations
- Desktop and mobile Playwright projects with proper test scoping
- Shared database connection to prevent leaks
- Mock server for external APIs with strict LIVE_API_TESTS=1 gating
- GitHub Actions CI pipeline with PostgreSQL service
- All build verification passes (typecheck, lint, unit tests, integration tests, build, E2E)

### ✅ Milestone 1: Complete Research Lifecycle
- Manual action resolution (no result, candidate URL, dismiss, retry)
- Source selection API with automatic initialization and consent flow
- Findings collection page with proper database schema alignment
- Research summary screen with adaptive polling
- Database migrations (0005) with proper journal registration
- Complete audit trail with accurate retry attempt tracking
- Hebrew slug support throughout navigation

## 📊 Latest Verification Results

### Commit & CI
**Latest Commit:** `ec1086126a928f143338454cdb4bdcdcc3a42893`
**GitHub Actions:** https://github.com/itaisinai/DiraTrack/actions/runs/34452284003
**Status:** ✅ Success
**Duration:** ~2 minutes
**E2E Tests:** 59/59 passed

### Local Test Runs
**Typecheck:** ✅ All packages pass
**Lint:** ✅ No errors
**Unit Tests:** ✅ 21 tests pass (including 2 new retry attempt tests)
**Integration Tests:** ✅ 5/5 pass (3 slug tests + 2 retry attempt tests)
**Build:** ✅ Production build succeeds
**E2E Tests:** ✅ 59/59 passed (chromium + mobile)

## 🔧 Critical Bug Fix: Retry Attempt Accounting

### Problem
`retryFailedSource` and `claimNextResearchJob` double-incremented the `attempts` counter:
- `retryFailedSource` calculated `nextAttempt = (lastJob?.attempts ?? 0) + 1` and inserted it
- `claimNextResearchJob` then incremented again: `attempts: sql\`${researchJobs.attempts} + 1\``
- Result: Two executions produced `attempts = 3` instead of `2`

### Solution
**Semantics Defined:** `researchJobs.attempts` represents the cumulative number of times the job has been claimed by a worker (i.e., actual executions).

**Fix Applied:**
1. `retryFailedSource` now inherits the previous attempt count without incrementing
2. `claimNextResearchJob` increments when the job is actually claimed
3. Audit events record the correct `retryAttemptNumber`

**Example Flow:**
- Initial job created: `attempts = 0`
- Worker claims: `attempts = 1` (first execution)
- Job fails, retry created: `attempts = 1` (inherited, not yet executed)
- Worker claims retry: `attempts = 2` (second execution)

### Test Coverage Added
**Integration Tests:** `packages/database/src/research.test.ts`
1. **retry attempt counting: claim increments, retry inherits**
   - Creates project, source, and research run
   - Claims job → verifies `attempts = 1`
   - Fails job and retries → verifies new job has `attempts = 1` (inherited)
   - Claims retry → verifies `attempts = 2`
   - Confirms total attempts matches actual executions

2. **retry audit event records correct attempt number**
   - Same setup and failure flow
   - Verifies audit event metadata records `retryAttemptNumber = 2`
   - Ensures audit trail reflects the intended retry semantics

**E2E Test Maintained:** `e2e/api.spec.ts` "POST .../retry retries failed check"
- Uses real browser wizard for duplicate-name projects
- Verifies failed → pending transition
- Error cleared
- Correct project/run ownership
- 202 response

## 🎨 Key Features Implemented

### Findings Collection
- **API Route**: GET `/api/projects/[slug]/findings`
- **Explicit DTO**: Joins `findings`, `sourceChecks`, and `sources` tables
- **Complete Metadata**: Returns source name, category, verification status, URL, matching identifiers
- **Proper Timestamps**: Uses `discoveredAt` instead of non-existent `createdAt`
- **UI Page**: `/projects/[slug]/findings` with full metadata rendering
- **Empty State**: Call-to-action for new projects
- **Hebrew Support**: Proper encoding throughout navigation

### E2E Test Coverage (59 tests)
**API Tests (chromium only):**
- Health & basic endpoints
- Project CRUD operations
- Research run lifecycle
- Source selection validation
- Manual action resolution (no-result, candidate-url, dismiss, **retry**)
- Cross-project protection
- Findings collection with metadata
- Validation errors

**User Flow Tests:**
- Create project via browser wizard (chromium + mobile)
- Duplicate project names generate unique slugs (chromium + mobile)
- Start research run (chromium + mobile)

**Live Integration Tests (@live tag):**
- Real Asia Cyrus API integration (chromium only)

### Test Infrastructure
- **Separate Test Database**: `diratrack_test` with validation via pg-connection-string parser
- **Safety Guards**: Prevents cleanup/migration on non-test databases
- **Shared Connection Pool**: Prevents postgres client leaks (max 10 connections)
- **Automatic Migrations**: global-setup checks schema and runs migrations if needed
- **Playwright Projects**: Desktop (1440x900) and Mobile (390x844) with proper grep filtering
- **Mock Server**: External API mocking with strict `LIVE_API_TESTS=1` check
- **GitHub Actions**: Full CI pipeline with PostgreSQL service container

### Manual Action Resolution
- **No Result**: Mark manual action completed with no findings
- **Candidate URL**: Add user-provided URL with HTTPS validation
- **Dismiss**: Skip source with required reason
- **Retry**: Restart failed source check with deterministic attempt tracking
- **Fixed Double Encoding**: Raw slugs passed to avoid Hebrew slug breakage

### Source Selection
- **Automatic Initialization**: `configureProjectSources` called before GET/PATCH
- **Source List API**: Returns metadata (isImplemented, requiresManualAction, sendsExternalData)
- **Conditional Consent**: Only shown when selected sources send external data
- **Empty Selection Validation**: Start button disabled when no sources selected

### Research Summary
- **Status Badge**: Color-coded run status
- **Statistics Grid**: 6 cards with metrics
- **Time Information**: Start, end, duration
- **Failed Sources**: Individual retry buttons
- **Warning Banners**: Partial completion alerts
- **Adaptive Polling**: 2s for active states, 10s for waiting-for-user, stops on terminal states

## 📦 Database Changes

**Migration 0005**: `milestone1_manual_actions`
- Added to source_checks: `lastCheckedAt`, `dismissedAt`, `dismissedReason`
- Indexes on both timestamp columns for filtering
- Properly registered in `_journal.json` and `0005_snapshot.json`

## 🔧 Code Quality Improvements

### Removed Unused Imports
1. ✅ Removed unused `sql` import from `e2e/test-helpers.ts` `forceSourceCheckToFail` function

### Documentation Added
1. ✅ `claimNextResearchJob`: Comprehensive JSDoc explaining attempt semantics with examples
2. ✅ `retryFailedSource`: Clear documentation of inheritance behavior and reasoning

## 🚀 Commands

```bash
# Full verification pipeline (local)
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run test:e2e

# Live external API tests (requires real APIs)
npm run test:e2e:live

# Database migrations
npm run db:migrate

# Individual test suites
npm run test:integration  # 5 integration tests
npm run test:e2e          # 59 E2E tests (chromium + mobile)
```

## 📝 Test Breakdown

**Unit Tests:** 21 tests
- 2 route-segment encoding tests
- 8 database schema constraint tests (using mocked data)
- 1 empty source list validation test
- 3 winning message extraction tests
- 5 source adapter tests
- 2 retry attempt accounting tests (skip without TEST_DATABASE_URL)

**Integration Tests:** 5 tests (via `npm run test:integration`)
- 3 slug generation tests (unique slugs, readable slugs, concurrent creation)
- 2 retry attempt accounting tests (claim increments, audit events)

**E2E Tests:** 59 tests
- 42 chromium tests (API + user flows + live integration)
- 17 mobile tests (user flows)

**Total Coverage:** All critical paths tested with proper isolation

## ✅ Ready for Merge

Latest commit: `ec1086126a928f143338454cdb4bdcdcc3a42893`

All requirements met:
- ✅ GitHub Actions CI: Success (59/59 E2E tests)
- ✅ Local E2E: 59/59 passed (two consecutive runs)
- ✅ Integration tests: 5/5 passed (including new retry tests)
- ✅ TypeScript: compiles cleanly
- ✅ ESLint: no errors
- ✅ Build: production build succeeds
- ✅ 0 failed tests
- ✅ 0 flaky tests
- ✅ Only diratrack_test accessed
- ✅ Retry attempt accounting: deterministic and correct
- ✅ Audit trail: accurate retry attempt numbers
- ✅ Findings metadata renders correctly
- ✅ Duplicate-project flow uses real browser wizard on desktop and mobile

**No follow-up work required** - all blockers resolved, full test coverage achieved, retry bug fixed with deterministic integration tests.
