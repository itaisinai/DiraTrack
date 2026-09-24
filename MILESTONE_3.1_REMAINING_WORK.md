# Milestone 3.1 Remaining Work

## Current Status (Commit 82b0cba)

**Passing:**
- Typecheck ✅
- Lint ✅  
- Build ✅

**Critical Issues Remain:**

## P1 Security Vulnerabilities

### 1. DNS Rebinding (CRITICAL)
**Status:** ❌ Vulnerable
**Location:** `streaming-downloader.ts`, `preview/route.ts`

Current code validates DNS once, then calls `fetch(url)` which performs independent DNS resolution.

**Attack:** Attacker returns public IP during validation, private IP during fetch.

**Fix Required:**
- Implement `safe-http-client.ts` with address pinning
- Resolve hostname once
- Validate ALL resolved IPs
- Connect to validated IP with original hostname in Host header
- Repeat for every redirect
- Use in both download and preview

**Test:** Mock DNS to return different IPs on sequential calls

### 2. Incomplete IPv6 Blocking (HIGH)
**Status:** ❌ Vulnerable  
**Location:** `url-security.ts`

Current regexes don't cover full CIDRs:
- `fc00::/7` - only blocks `fc00::` not `fc01::`, `fd12::`, etc.
- `fe80::/10` - only blocks `fe80::` not `fe90::`, etc.
- IPv4-mapped addresses not fully blocked

**Vulnerable IPs pass validation:**
```
fc01::1
fd12::1  
fe90::1
::ffff:10.0.0.1
::ffff:172.16.0.1
::ffff:192.168.1.1
::ffff:127.0.0.1
::ffff:169.254.169.254
```

**Fix Required:**
- Use proper CIDR/byte comparison
- Block `fc00::/7` (includes fc00-fdff)
- Block `fe80::/10` (includes fe80-febf)
- Block all IPv4-mapped private addresses

**Test:** Verify all listed IPs are rejected

### 3. Timeout Cleared Too Early (MEDIUM)
**Status:** ❌ Vulnerable
**Location:** `streaming-downloader.ts` line 90

```typescript
clearTimeout(timeout); // WRONG - clears after headers
```

Timeout cleared immediately after receiving response headers. Server can stall body indefinitely.

**Fix Required:**
- Keep timeout active during full body streaming
- Clear only after file closed and validated
- Add test for stalled body after headers

### 4. File Restoration Broken (HIGH)
**Status:** ❌ Broken
**Location:** `document-service.ts` lines 177-190, 360-390

When finding existing `file-deleted` document:
1. Downloads/uploads new bytes
2. **DELETES** temp file via `cleanupTempFile(tempPath)`
3. Sets status=downloaded
4. **No physical file exists**

**Fix Required:**
- Do NOT delete temp file for file-deleted restoration
- Move temp file to proper location
- Update localPath
- Clear physicalFileDeletedAt
- Set status=downloaded AFTER file exists
- Test by: restore, then serve and verify bytes match

## Missing Milestone 3.1 Features

### 5. Remote-Only Documents (501 Error)
**Status:** ❌ Not Implemented
**Location:** `documents/route.ts` line 48

Returns `501 Remote-only documents not yet implemented` when `downloadFile=false`.

**Requirements:**
- Store URL without downloading
- Link to finding
- No localPath
- Status = remote-only
- Add "שמירת הקישור בלבד" to dialog
- Add "Add Remote URL" action to library
- Allow download later

### 6. Re-Download Flow Missing
**Status:** ❌ Not Implemented
**Location:** Document library UI

No re-download button for:
- `remote-only` documents
- `file-deleted` documents  
- `failed` documents with remote URL

**Requirements:**
- Show download/re-download action
- Use stored remoteUrl
- Restore physical file correctly
- Safe error when no URL

### 7. Owner-Scoped Access Not Enforced
**Status:** ❌ Security Issue
**Location:** All document routes

Routes query `projects.where(eq(projects.currentSlug, slug))` without owner check.

Cross-project access returns data instead of 404.

**Fix Required:**
- Use `ensureLocalUser` and `findProjectBySlug`
- Apply to all routes
- Cross-project must return 404
- Add test: user A cannot access user B's documents

## Test Infrastructure

### 8. Tests Not Running
**Status:** ❌ Tests Skipped
**Location:** `packages/document-processing/__tests__/`

- Package has no `test` script
- `npm test` doesn't discover document tests
- Imports vitest but no vitest dependency
- Contains placeholder `expect(true).toBe(true)`
- Uses `example.com` (live DNS)

**Fix Required:**
- Add test script using node:test
- Make tests discoverable by root `npm test`
- Remove vitest imports
- Mock DNS/HTTP, no live requests
- Remove placeholders
- Add meaningful assertions

## Code Quality Issues

### 9. Type Shortcuts
**Status:** ❌ Technical Debt
**Location:** Multiple files

```typescript
type DatabaseOrTransaction = Database | any;  // Bad
tx: any  // Bad  
as unknown as DocumentMetadata  // Bad
// eslint-disable  // Suppressing real errors
```

**Fix Required:**
- Create proper structural type for db/tx
- Type transaction parameters correctly
- Remove double assertions
- No undocumented `any`

### 10. Filesystem/Database Consistency
**Status:** ❌ Race Conditions
**Location:** `document-service.ts`

Issues:
- Files written before DB transaction commits
- Failed transaction leaves orphaned file
- Physical deletion in transaction without rollback compensation
- `unlink` failures ignored
- No concurrent download coordination

**Fix Required:**
- Write to temp, move after DB commit
- Rollback deletes temp file
- Handle ENOENT explicitly
- Coordinate concurrent identical downloads
- Add integration tests

## Minor Issues

### 11. Path Traversal in Serve
**Status:** ❌ Vulnerability
**Location:** `serve/route.ts`

Uses `path.join(process.cwd(), doc.localPath)` without validating `localPath` stays in document root.

**Fix:** Resolve and verify containment

### 12. Preview SSRF
**Status:** ❌ Vulnerability  
**Location:** `preview/route.ts`

Uses `redirect: "follow"` without validation. Should use safe-http-client.

### 13. Missing File Validation
- No PDF structure validation beyond magic bytes
- ZIP accepted as DOCX/XLSX without structure check
- OLE2 accepted as DOC/XLS without structure check
- No strict UTF-8 validation for text

### 14. Modal Accessibility
- No focus trap
- No focus restoration
- Escape key handler incomplete

### 15. localPath Exposure
Delete endpoints may log/return absolute filesystem paths in errors.

## Test Coverage Gaps

**Unit tests needed:**
- DNS rebinding prevention
- IPv6 CIDR blocking
- Body stream timeout
- Temp file cleanup
- Path traversal prevention
- Ambiguous format rejection

**Integration tests needed:**
- Owner/project isolation
- File restoration actual bytes
- Concurrent downloads
- Transaction rollback
- Filesystem failure compensation
- Cross-project access denial

**API tests needed:**
- All routes with invalid/cross-project access
- Remote-only CRUD
- Re-download

**E2E tests needed:**
- Finding → save link only
- Finding → download
- Upload
- Re-download
- Delete local file
- Remove from project
- PDF viewer accessibility

## Documentation Issues

PR description overstates:
- "SSRF protection complete" - DNS rebinding vulnerable
- "Project isolation enforced" - no owner check
- "Re-download works" - bytes not restored
- "Tests executed" - tests not running
- "Ready to merge" - critical issues remain

## Verification Status

| Command | Status |
|---------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run lint` | ✅ Pass |
| `npm test` | ⚠️ Pass (but document tests not included) |
| `npm run test:integration` | ❓ Not verified |
| `npm run build` | ✅ Pass |
| `npm run test:e2e` | ❓ Not verified |
| `git diff --check` | ✅ Pass |

## Estimated Effort

**Critical (must fix):** ~40-60 commits
- DNS rebinding fix + tests: 3-5 commits
- IPv6 fix + tests: 2-3 commits  
- File restoration fix + tests: 3-4 commits
- Timeout fix + tests: 2 commits
- Owner-scoping + tests: 5-8 commits
- Test infrastructure: 3-5 commits
- Remote-only implementation: 4-6 commits
- Re-download implementation: 3-4 commits

**Important (should fix):** ~20-30 commits
- Filesystem/DB consistency
- Path traversal protection
- Type quality
- Preview SSRF
- File validation hardening

**Nice to have:** ~10-15 commits
- Modal accessibility
- Enhanced search
- Better error messages

**Total estimated:** 70-105 commits to complete Milestone 3.1 fully

## Recommendation

Current PR is NOT ready to merge due to:
1. Critical security vulnerabilities (DNS rebinding, IPv6 bypass)
2. Broken core feature (file restoration)
3. Missing required features (remote-only, re-download)
4. Tests not running
5. Owner-scoping not enforced

**Suggested approach:**
1. Fix 4 P1 security issues first (DNS rebinding, IPv6, timeout, restoration)
2. Add test infrastructure
3. Implement missing features (remote-only, re-download)
4. Enforce owner-scoping
5. Add comprehensive test coverage
6. Fix remaining code quality issues
7. Update PR description

**Timeline:** 2-3 days of focused work for complete milestone.
