# Milestone 3.1 Progress Report

**Branch:** `feat/milestone3-document-stabilization`  
**Latest Commit:** `12bea6a`  
**Date:** 2026-09-24

## Summary

Significant progress made on PR #25. All 4 P1 security issues now have implementations, access control enforced, and test infrastructure operational. **Not yet ready to merge** - several functional gaps remain.

## Completed Work Since Last Update

### ✅ P1 #1: DNS Rebinding Protection (RESOLVED)
**Commit:** `c485017`

**Implementation:**
- Created `safe-http-client.ts` with Undici Agent + custom DNS lookup
- Integrated into `streaming-downloader.ts` (replaced standard fetch)
- Integrated into `preview/route.ts`
- DNS resolved and validated ONCE per URL
- Undici Agent.connect.lookup returns only pre-validated addresses
- Original hostname preserved for TLS SNI and certificate validation
- Every redirect destination re-validated with fresh DNS pinning

**Security Guarantees:**
- ✅ Prevents TOCTOU DNS rebinding attacks
- ✅ No hostname→IP substitution (preserves HTTPS validation)
- ✅ Both download and preview use same secure transport

**Test Coverage:** 6 tests with mocked DNS in `safe-http-client.test.ts`

**All 4 P1 Issues Now Implemented:**
1. ✅ DNS rebinding (commit c485017)
2. ✅ IPv6 validation (commit a6a792e)
3. ✅ Streaming timeout (commit a6a792e)
4. ⚠️ File restoration (commit a6a792e - needs redesign, see gaps below)

### ✅ Access Control Enforcement (RESOLVED)
**Commit:** `12bea6a`

**Implementation:**
- All 7 document endpoints now use `ensureLocalUser()` + `findProjectBySlug()`
- Canonical slug resolution (handles slug history)
- Owner validation on every request
- Consistent 404 for cross-project access (no existence leakage)

**Updated Routes:**
- POST /documents (download)
- PUT /documents (upload)
- GET /documents (list)
- GET /documents/:id (metadata)
- DELETE /documents/:id (delete/remove)
- GET /documents/:id/serve (serve file)
- POST /documents/preview (preview)

**Security Improvement:**
- ✅ Cross-project access blocked
- ✅ Owner-scoped queries
- ✅ No accidental data leakage

### ✅ Test Infrastructure (COMPLETE)
**Status:** 57 document tests operational in CI

**Tests:**
- `url-security.test.ts`: 24 tests (IPv4/IPv6 validation)
- `file-validation.test.ts`: 27 tests (magic bytes, sanitization)
- `safe-http-client.test.ts`: 6 tests (DNS pinning, mocking)
- `streaming-downloader.test.ts`: Placeholder tests (needs expansion)

**All tests passing:** 81/81 (57 document + 24 other)

## Remaining Critical Gaps

### ❌ P1 #4: File Restoration (NEEDS REDESIGN)
**Status:** Basic implementation exists but incomplete per review

**Current Implementation Problems:**
1. Assumes `localPath` is still valid after deletion
   - Correct semantics require `localPath` to be cleared
2. Returns stale pre-update record
3. No path containment validation
4. Filesystem writes before DB updates (no rollback)
5. Upload uses non-atomic direct write

**Required Redesign:**
- Derive safe new storage path when `localPath` absent
- Write to staged temp file → atomic rename
- Update DB ONLY after file exists
- Compensate (delete file) if DB update fails
- Return updated document record
- Add regression tests: restore → serve → verify bytes

### ❌ Missing Regression Tests
**Gap:** Many claimed behaviors have no tests

**Required Tests (DO NOT EXIST):**
1. Stalled response-body timeout test
2. Temporary-file cleanup test
3. Downloaded-file restoration test
4. Uploaded-file restoration test
5. Serving restored bytes test
6. Document-service database transitions
7. Filesystem failure → DB compensation
8. Concurrent downloads safety

**Current State:** Only static validation tests exist (IP ranges, filenames, DNS mocking)

### ❌ Remote-Only Lifecycle (NOT IMPLEMENTED)
**Status:** Returns 501

**Required:**
- Accept `downloadFile=false` parameter
- Store URL, finding, source without downloading
- No `localPath`, status = `remote-only`
- UI: "שמירת הקישור בלבד" dialog option
- UI: "Add Remote URL" library action
- Re-download action for `remote-only`, `file-deleted`, `failed` states
- Tests for remote-only CRUD

### ❌ Deletion Semantics (BROKEN)
**Problem:** Catches all `unlink` errors, always marks deleted

**Current Behavior:**
```typescript
try {
  await fs.unlink(filePath);
} catch (error) {
  console.error("File deletion error:", error);
  // WRONG: marks as deleted anyway
}
```

**Required:**
- Distinguish `ENOENT` (OK - already absent) from real errors (FAIL)
- Clear `localPath` when marking `file-deleted`
- Return error if filesystem operation fails for real reason
- Add filesystem failure tests

### ❌ Path Containment (NOT IMPLEMENTED)
**Risk:** `doc.localPath` could reference `../../../etc/passwd`

**Required:**
- Resolve both storage root and requested path
- Reject if resolved path outside storage root
- Handle `..`, absolute paths, symlinks
- Apply to serve, restoration, all file operations

### ❌ Serving Hardening (INCOMPLETE)
**Current Issues:**
- Uses `fs.readFile()` (entire file in memory)
- No `X-Content-Type-Options: nosniff` header
- All PDFs rendered inline without validation
- No attachment disposition for non-PDFs

**Required:**
- Stream with `fs.createReadStream()`
- Add `X-Content-Type-Options: nosniff`
- Only validated PDFs inline
- Others as attachment with safe `Content-Disposition`

### ❌ File Validation Gaps
**Current Issues:**
- Any ZIP accepted as DOCX/XLSX without structure validation
- Any OLE2 accepted as DOC/XLS without validation
- No strict UTF-8 validation for text files

**Required:**
- Validate OpenXML container (`[Content_Types].xml`)
- Reject generic ZIPs as Office formats
- Validate OLE2 structure OR reject legacy formats
- Require strict UTF-8 for text/plain

### ❌ Type Quality Issues
**Violations:**
```typescript
type DatabaseOrTransaction = Database | any;  // WRONG
tx: any  // WRONG
as unknown as DocumentMetadata  // WRONG
```

**Required:**
- Proper structural transaction types
- Type `tx` parameters correctly
- Remove double assertions
- No undocumented `any`

### ❌ Integration & E2E Tests (MISSING)
**Status:** No integration or E2E tests exist

**Required Integration:**
- Document service full CRUD
- Restoration → serve → verify bytes match
- Concurrent uploads/downloads
- Cross-project access denial
- Database rollback scenarios

**Required E2E:**
- Finding → save link only → library
- Finding → download → preview
- Direct upload → library → preview
- Search by filename/source/finding
- Delete local file → metadata remains → re-download
- Desktop and mobile RTL flows

## Verification Status

```
✅ npm run typecheck: PASS
✅ npm run lint: PASS
✅ npm test: 81 tests PASS (57 document, 24 other)
❌ Integration tests: DO NOT EXIST
❌ E2E tests: DO NOT EXIST
⚠️ Test coverage overstated - behavioral tests missing
```

## Progress Metrics

**Completed:**
- 4/4 P1 security issues implemented (1 needs redesign)
- 7/7 document routes owner-scoped
- 57 document tests operational in CI
- DNS pinning with Undici integration
- Access control enforcement

**In Progress:**
- File restoration redesign
- Regression test suite

**Not Started:**
- Remote-only lifecycle
- Deletion error handling
- Path containment
- Serving hardening
- Office format validation
- Integration tests
- E2E tests
- Type quality fixes

**Estimated Remaining:** ~30-40 commits across 6-8 hours of focused work

## Next Priority Actions

1. **Redesign file restoration** (P1 #4)
   - Staged temp → atomic publish → DB update → compensate
   - Derive path when localPath absent
   - Add restoration regression tests

2. **Add critical regression tests**
   - Timeout behavior
   - File cleanup
   - Restoration flows
   - Database failures

3. **Implement remote-only lifecycle**
   - Backend: downloadFile=false handling
   - UI: dialog option + library action
   - Re-download flows

4. **Fix deletion and path safety**
   - ENOENT vs real errors
   - Clear localPath consistently
   - Storage-root containment

5. **Complete serving hardening**
   - Stream files
   - Security headers
   - Validated inline rendering

6. **Add integration & E2E tests**
   - Document service integration suite
   - Full user flows (desktop + mobile)

7. **Fix type quality**
   - Remove `any` and double assertions
   - Proper transaction types

8. **Final verification & documentation**
   - All tests pass (unit + integration + E2E)
   - GitHub Actions green
   - Reply to P1 review threads with fixes
   - Update PR description truthfully
   - Resolve review threads

## Tokens Used: ~140k / 200k

This session made substantial progress on security foundations (all P1 issues implemented) and access control. The remaining work focuses on correctness (restoration redesign), completeness (remote-only, tests), and hardening (serving, validation).
