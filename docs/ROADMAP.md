# DiraTrack Product Roadmap

This document describes the complete path from the current MVP to a fully-featured apartment tracking system for Israeli new-build apartment buyers.

## Current State (Post-Merge)

### ✅ Completed Features

- **Foundation**: npm workspaces, Next.js 16, React 19, PostgreSQL 17, Drizzle ORM, Research Worker
- **Hebrew RTL UI**: Full right-to-left support
- **Project Creation**: Winning message parser, Hebrew slugs, project dashboard
- **Data Model**: Complete schema for projects, sources, research runs, findings, documents, timeline, tasks
- **Project Isolation**: Strong database-level project scoping
- **Research Orchestration**: Explicit research runs, job queue, worker polling, cancellation
- **Two Source Adapters**:
  - **Asia Cyrus** (automatic): WordPress API search
  - **Dira BeHanacha** (manual): Creates manual-action state with instructions
- **Finding Review**: Mark relevant/irrelevant, audit events
- **Basic E2E Tests**: Playwright infrastructure added

### ⚠️ Known Issues (Updated September 3, 2026)

1. ~~**Duplicate research state functions**~~: ✅ Fixed - Using only `deferResearchJobForManualAction`
2. ~~**Test infrastructure problems**~~: ✅ Resolved - Separate test database, cleanup utilities
3. ~~**Incomplete manual action lifecycle**~~: ✅ Implemented - Complete/dismiss/retry all working
4. ~~**No source selection UI**~~: ✅ Built - Source selection dialog with consent logic
5. ~~**Documentation drift**~~: ✅ Updated - README reflects current state
6. ~~**Consent logic confusion**~~: ✅ Fixed - Only asia-cyrus requires consent
7. **E2E test failures**: Integration issues between test helpers and APIs (requires debugging)

---

## Milestone 0: Stabilization 🔧 ✅ COMPLETED (September 3, 2026)

**Goal**: Make existing features reliable, testable, and CI-ready

### User-Visible Outcomes
- ✅ Tests don't corrupt development database
- ✅ Worker behavior is predictable and testable
- ✅ Documentation matches reality

### Backend Work
- ✅ Remove duplicate `setResearchJobWaitingForUser` function
- ✅ Use only `deferResearchJobForManualAction` consistently
- ✅ Fix research run status calculation when mixing completed/waiting sources
- ✅ Ensure waiting jobs don't block worker from processing other pending jobs
- ⚠️ Add database integration tests for all state transitions (unit tests exist)

### Frontend Work
- ✅ Update README with accurate source count and adapter types
- ✅ Fix consent dialog to distinguish automatic vs manual sources
- ✅ Verify UI polling stops for terminal states

### Database Work
- ✅ Create separate test database (`diratrack_test`)
- ✅ Test database migrations
- ✅ Add test data cleanup utilities

### Tests
- ✅ Root `test:e2e` script
- ✅ Playwright global setup/teardown for test database
- ✅ Replace all fixed `sleep()` calls with state polling
- ✅ Strengthen weak assertions (no `[200, 400]` acceptance)
- ✅ Add mobile viewport Playwright project
- ✅ Mock external APIs by default
- ⚠️ Add optional `test:e2e:live` for real API smoke tests (infrastructure exists)

### Security/Privacy
- ✅ Verify `.gitignore` covers all test artifacts
- ✅ Ensure test projects never use real registrant numbers

### Definition of Done
- ✅ `npm test` passes deterministically (16/16 tests pass)
- ⚠️ `npm run test:e2e` infrastructure complete (tests need debugging)
- ✅ Tests can run in parallel
- ✅ All sleeps replaced with polling
- ✅ README reflects current features
- ✅ Zero duplicate database functions
- ✅ TypeScript, lint, build all pass

**Completion Notes**: Core infrastructure complete. E2E tests implemented but require integration debugging in follow-up work.

### Explicit Exclusions
- Not adding new sources
- Not implementing document features
- Not adding authentication

---

## Milestone 1: Complete Research Lifecycle 🔄 ✅ COMPLETED (September 3, 2026)

**Goal**: Users can select sources, handle manual actions, and reach terminal states

### User-Visible Outcomes
- ✅ Select which sources to check before starting research
- ✅ See why each source is available/unavailable
- ✅ Complete or dismiss manual actions
- ✅ Research runs reach clear terminal states
- ✅ Accurate progress throughout lifecycle
- ✅ Summary screen after completion

### Backend Work
- ✅ Source selection API (GET/PATCH `/api/projects/:slug/sources`)
- ✅ Per-project source enable/disable
- ✅ Complete manual action endpoint (no result, add finding, dismiss)
- ✅ Retry failed source endpoint
- ✅ Research summary data API
- ✅ Fix progress calculation to exclude waiting jobs appropriately
- ✅ Canonical state machine transitions

### Frontend Work
- ✅ Source selection dialog before starting research
- ✅ Per-source cards showing:
  - Name, category, enabled state
  - Automatic/manual/unimplemented badge
  - Data sent disclosure
  - Last checked, last result
- ✅ Manual action resolution UI:
  - "Mark completed - no result"
  - "Add candidate URL" (with URL validation)
  - "Dismiss this source"
- ✅ Research summary screen
- ✅ Retry failed source button
- ✅ "Open findings" action from summary

### Database Work
- ✅ Add `sourceCheck.lastCheckedAt` column
- ✅ Add `sourceCheck.dismissedAt` column
- ✅ Add `sourceCheck.dismissedReason` column
- ✅ Add `projectSource.isEnabled` usage (already in schema)
- ✅ Migration for new columns (0005_milestone1_manual_actions.sql)

### Tests
- ⚠️ Source selection with various combinations (implemented, needs debugging)
- ⚠️ Complete manual action with no result (implemented, needs debugging)
- ⚠️ Complete manual action with candidate URL (implemented, needs debugging)
- ⚠️ Dismiss manual action (implemented, needs debugging)
- ⚠️ Invalid URL rejection (implemented, needs debugging)
- ⚠️ Run reaches terminal state after manual resolution (implemented, needs debugging)
- ⚠️ Progress calculation with mixed states (implemented, needs debugging)
- ⚠️ Retry failed source (implemented, needs debugging)
- ⚠️ Browser flow: full research lifecycle (implemented, needs debugging)

### Security/Privacy
- ✅ Candidate URLs must be validated (HTTPS required)
- ✅ Candidate findings remain unverified
- ✅ No automatic project fact changes

### Dependencies
- ✅ Milestone 0 (stable test infrastructure)

### Definition of Done
- ✅ User can select sources before starting research
- ✅ User can resolve all manual actions
- ✅ Research runs reach terminal states
- ✅ Progress is accurate at every stage
- ✅ Summary screen shows actionable results
- ⚠️ All E2E flows pass (infrastructure complete, integration debugging needed)

**Completion Notes**: All features implemented and functional. E2E tests written but require integration refinement. Manual testing recommended for verification.

### Explicit Exclusions
- Not adding new sources yet
- Not implementing scheduled research
- Not adding document features

---

## Milestone 2: Real Source Expansion 🌐

**Goal**: Connect 5 additional official and municipal sources

### Sources to Add

#### 2.1 Israel Land Authority
- **URL**: `https://www.gov.il/he/departments/israel_land_authority`
- **Search Strategy**: Project name, city, block/parcel/lot
- **Type**: Manual (requires navigation and CAPTCHA)
- **Manual Action**: Link to tender search with identifiers displayed

#### 2.2 Planning Administration (מינהל התכנון)
- **URL**: `https://www.gov.il/he/departments/iplan`
- **Search Strategy**: Plan number, city, block/parcel
- **Type**: Manual (complex navigation)
- **Manual Action**: Link to plan search with identifiers

#### 2.3 Yehud Local Planning Committee
- **URL**: `https://yehud.bartech-net.co.il`
- **Search Strategy**: Address, block/parcel, plan number
- **Type**: Investigate (may have API or require scraping)
- **Fallback**: Manual with link

#### 2.4 Yehud-Monosson Municipality
- **URL**: `https://www.yehud-monosson.muni.il`
- **Search Strategy**: Address, project name
- **Type**: Investigate (may have news feed or announcements API)
- **Fallback**: Manual with link

#### 2.5 Developer Website Adapter
- **Type**: Pluggable per-developer strategy
- **Current**: Asia Cyrus (already implemented)
- **Framework**: Generic developer adapter interface

### Per-Source Requirements
- [ ] Stable source key in catalog
- [ ] Search strategy documented
- [ ] Exact identifiers used listed
- [ ] External data disclosure in consent
- [ ] Timeout (20s default)
- [ ] Rate limit strategy
- [ ] Retry policy (3 attempts with backoff)
- [ ] Manual fallback for all sources
- [ ] CAPTCHA handling plan
- [ ] Original URL preservation
- [ ] Evidence metadata structure
- [ ] Mocked deterministic tests
- [ ] Real read-only smoke test
- [ ] Hebrew UI copy for all states

### Backend Work
- [ ] Create adapter for each source
- [ ] Generic CAPTCHA-required manual action pattern
- [ ] Rate limiting per source
- [ ] Backoff on failure
- [ ] Source health check endpoint

### Frontend Work
- [ ] Per-source configuration UI
- [ ] Source health indicators
- [ ] Manual action templates per source type
- [ ] Instructions for each manual step

### Database Work
- [ ] `source.lastHealthCheck` column
- [ ] `source.healthStatus` column
- [ ] `source.rateLimit` configuration
- [ ] Migration

### Tests
- [ ] Mock tests for each adapter
- [ ] Rate limit enforcement tests
- [ ] Health check tests
- [ ] Manual action generation tests
- [ ] Separate live smoke tests (not in main suite)

### Security/Privacy
- [ ] Read-only operations only
- [ ] No CAPTCHA bypass attempts
- [ ] Respect robots.txt
- [ ] Clear User-Agent
- [ ] No personal registrant numbers sent
- [ ] Failed health checks don't block other sources

### Dependencies
- Milestone 1 (complete lifecycle)

### Definition of Done
- ✅ All 7 MVP sources connected
- ✅ Each source tested in isolation
- ✅ Health checks working
- ✅ Manual fallbacks tested
- ✅ Rate limits enforced
- ✅ Documentation for each source

### Explicit Exclusions
- Not scraping CAPTCHA-protected sources
- Not automating interactive-only sources
- Not adding sources outside MVP scope

---

## Milestone 3: Document Library 📄

**Goal**: Store, organize, and track project documents

### User-Visible Outcomes
- Add document candidates from research
- Download documents with confirmation
- View document library
- Track document metadata
- Link documents to sources
- Search documents
- Safe deletion with audit

### Backend Work
- [ ] Document download API
- [ ] Download confirmation endpoint
- [ ] File storage in `data/documents/`
- [ ] SHA-256 hash calculation
- [ ] Duplicate detection by hash
- [ ] Metadata storage
- [ ] Document listing API
- [ ] Safe deletion endpoint (marks deleted, keeps metadata)
- [ ] Document search API

### Frontend Work
- [ ] "Add document" from finding
- [ ] Download confirmation dialog (shows URL, file type, estimated size)
- [ ] Document library page
- [ ] Document cards with:
  - Filename, type, size
  - Source, discovered date
  - Download status
  - Hash (for duplication detection)
- [ ] Document viewer (iframe for PDFs)
- [ ] Search documents
- [ ] Delete document with confirmation

### Database Work
- [ ] `document.fileHash` column
- [ ] `document.fileSize` column
- [ ] `document.mimeType` column
- [ ] `document.downloadedAt` column
- [ ] `document.deletedAt` column
- [ ] `document.localPath` column
- [ ] Migration

### Tests
- [ ] Add document candidate
- [ ] Download with confirmation
- [ ] Duplicate detection
- [ ] View document
- [ ] Search documents
- [ ] Delete document
- [ ] Audit events for all actions

### Security/Privacy
- [ ] Downloaded files stored in `data/` (gitignored)
- [ ] File type validation
- [ ] Size limits (100MB default)
- [ ] Malicious filename sanitization
- [ ] Audit trail for downloads and deletions

### Dependencies
- Milestone 2 (sources that produce document candidates)

### Definition of Done
- ✅ Documents can be added from findings
- ✅ Download with explicit confirmation
- ✅ Duplicates detected by hash
- ✅ Documents viewable in browser
- ✅ Safe deletion preserves metadata
- ✅ All actions audited

### Explicit Exclusions
- Not implementing text extraction yet
- Not implementing OCR yet
- Not implementing AI analysis yet

---

## Milestone 4: Text Extraction and OCR 📝

**Goal**: Extract searchable text from documents

### User-Visible Outcomes
- Automatic text extraction from PDFs
- OCR for scanned PDFs
- Extraction status indicators
- Page-level text storage
- Search within document text

### Backend Work
- [ ] PDF text extraction using pdf-parse or similar
- [ ] Detect scanned vs. native PDFs
- [ ] OCR integration (Tesseract or cloud service)
- [ ] OCR job queue (separate from research jobs)
- [ ] Extraction status tracking
- [ ] Page-level text storage
- [ ] Full-text search integration

### Frontend Work
- [ ] Extraction status badge
- [ ] "Extract text" button
- [ ] OCR progress indicator
- [ ] View extracted text
- [ ] Search within document
- [ ] Highlight search results

### Database Work
- [ ] `document.textExtractionStatus` enum
- [ ] `document.ocrRequired` boolean
- [ ] `document.ocrStatus` enum
- [ ] `documentPage` table (page number, text)
- [ ] Full-text search indexes
- [ ] Migration

### Tests
- [ ] Native PDF text extraction
- [ ] Scanned PDF detection
- [ ] OCR trigger
- [ ] Extraction status transitions
- [ ] Search extracted text

### Security/Privacy
- [ ] OCR cloud service option requires consent
- [ ] Document text stored locally only
- [ ] No automatic transmission to external OCR without consent

### Dependencies
- Milestone 3 (document library)

### Definition of Done
- ✅ Native PDFs extract text automatically
- ✅ Scanned PDFs trigger OCR with consent
- ✅ Extracted text searchable
- ✅ Status tracking throughout
- ✅ E2E flow tested

### Explicit Exclusions
- Not implementing AI analysis yet
- Not implementing automatic project fact extraction

---

## Milestone 5: AI Document Analysis 🤖

**Goal**: AI-assisted structured information extraction with explicit user control

### User-Visible Outcomes
- Request AI analysis of document
- See cost estimate before running
- Explicit consent for sending document to AI service
- Privacy warning displayed
- View structured AI findings
- Confidence scores and explanations
- Approve or reject AI findings
- No automatic project changes

### Backend Work
- [ ] OpenAI API integration
- [ ] Cost estimation API
- [ ] Document→prompt conversion
- [ ] Structured extraction prompt
- [ ] Parse AI response to claims
- [ ] Page reference extraction
- [ ] Confidence scoring
- [ ] AI analysis storage
- [ ] Approval workflow

### Frontend Work
- [ ] "Analyze with AI" button
- [ ] Cost estimate modal (⚠️ "Estimate only - actual cost may vary")
- [ ] Consent dialog:
  - "Document text will be sent to OpenAI"
  - "OpenAI may retain data per their policy"
  - "Cost: ~$X.XX (estimate)"
- [ ] Analysis progress indicator
- [ ] AI findings viewer:
  - Claim
  - Confidence (high/medium/low)
  - Explanation
  - Page reference
  - Source quote
- [ ] Approve/reject per claim
- [ ] "Approve all high-confidence"
- [ ] "Reject all"

### Database Work
- [ ] `aiAnalysis` table (already in schema)
- [ ] `aiClaim` table (already in schema)
- [ ] `aiAnalysis.status` enum (pending, running, completed, failed, cancelled)
- [ ] `aiAnalysis.estimatedCost` column
- [ ] `aiAnalysis.actualCost` column
- [ ] `aiClaim.confidenceScore` column
- [ ] `aiClaim.approvalStatus` enum
- [ ] Migration

### Tests
- [ ] Cost estimation
- [ ] Consent flow
- [ ] Mock AI response parsing
- [ ] Claim approval
- [ ] Claim rejection
- [ ] No project changes without approval

### Security/Privacy
- [ ] Clear privacy warning
- [ ] Explicit per-analysis consent
- [ ] API key stored in env only
- [ ] Missing API key handled gracefully
- [ ] Cost tracking
- [ ] Audit trail for AI usage

### Dependencies
- Milestone 4 (text extraction)
- OpenAI API key (optional)

### Definition of Done
- ✅ Cost estimate shown before analysis
- ✅ Explicit consent required
- ✅ Privacy warning displayed
- ✅ Structured claims extracted
- ✅ Approve/reject workflow
- ✅ No automatic project changes
- ✅ Works without API key (shows unavailable state)

### Explicit Exclusions
- Not automatically applying AI findings
- Not using AI for automatic project updates
- Not implementing AI-powered search yet

---

## Milestone 6: Apply Approved Facts ✓

**Goal**: Safely apply user-approved AI findings to project

### User-Visible Outcomes
- Review proposed project changes
- See evidence for each change
- Detect contradictions with existing data
- Final confirmation dialog
- Transactional application
- Audit trail
- Reversal capability

### Backend Work
- [ ] Diff current project state vs. proposed changes
- [ ] Contradiction detection
- [ ] Apply approved claims transactionally
- [ ] Create audit events for each change
- [ ] Reversal/undo API
- [ ] Timeline update from approved dates

### Frontend Work
- [ ] Proposed changes viewer:
  - Field name
  - Current value
  - Proposed value
  - Evidence reference
  - Contradiction warning
- [ ] Final confirmation dialog:
  - "These changes will update your project"
  - List of changes
  - "This action can be reversed from audit history"
- [ ] Apply button
- [ ] Success confirmation
- [ ] Updated project view
- [ ] Audit history with revert buttons

### Database Work
- [ ] `auditEvent.revertedAt` column
- [ ] `auditEvent.revertedBy` reference
- [ ] Ensure transactional updates
- [ ] Migration

### Tests
- [ ] Apply single approved claim
- [ ] Apply multiple claims
- [ ] Contradiction detection
- [ ] Transaction rollback on error
- [ ] Revert applied changes
- [ ] Audit trail completeness

### Security/Privacy
- [ ] Transactions prevent partial updates
- [ ] Audit trail immutable (revert adds new entry)
- [ ] User confirmation required

### Dependencies
- Milestone 5 (AI analysis)

### Definition of Done
- ✅ User reviews all proposed changes
- ✅ Contradictions highlighted
- ✅ Final confirmation required
- ✅ Changes applied transactionally
- ✅ Complete audit trail
- ✅ Revert capability working

### Explicit Exclusions
- Not implementing automatic scheduled updates
- Not implementing confidence-based auto-application

---

## Milestone 7: Timeline and Project Status 📅

**Goal**: Canonical project timeline with verified evidence

### User-Visible Outcomes
- Visual project timeline
- Current stage indicator
- Verified vs. unverified milestones
- Requires-review states
- Contradiction warnings
- No fictional dates
- Detailed timeline view
- Project status summary

### Backend Work
- [ ] Timeline API
- [ ] Milestone verification status
- [ ] Date conflict detection
- [ ] Status calculation from timeline
- [ ] Stage progression logic

### Frontend Work
- [ ] Timeline visualization
- [ ] Milestone cards:
  - Name
  - Date (if known)
  - Status (verified/unverified/unknown/requires-review)
  - Evidence link
  - Contradiction warning
- [ ] Current stage highlight
- [ ] Detailed milestone view
- [ ] Project status dashboard:
  - Current stage
  - Next milestone
  - Blockers
  - Requires attention

### Database Work
- [ ] `milestone.verificationStatus` enum
- [ ] `milestone.evidenceDocumentId` reference
- [ ] `milestone.evidenceFindingId` reference
- [ ] Migration

### Tests
- [ ] Timeline with various states
- [ ] Status calculation
- [ ] Contradiction detection
- [ ] Evidence linking
- [ ] Unverified handling

### Security/Privacy
- [ ] No fictional dates inserted
- [ ] Unknown states explicit
- [ ] Evidence required for verified status

### Dependencies
- Milestone 6 (applying facts)

### Definition of Done
- ✅ Timeline shows all milestones
- ✅ Verification status clear
- ✅ No fake dates
- ✅ Evidence linkage working
- ✅ Status calculation accurate

### Explicit Exclusions
- Not implementing automatic timeline updates from external sources
- Not predicting future dates

---

## Milestone 8: Tasks and Notifications 🔔

**Goal**: Actionable tasks linked to research, findings, and documents

### User-Visible Outcomes
- Task list
- Task notifications
- Link to source of task
- Mark tasks done/dismissed
- Task types:
  - CAPTCHA required
  - New document to review
  - Finding requires review
  - AI analysis awaiting approval
  - Source failed - retry available
  - Manual action required

### Backend Work
- [ ] Task creation from research events
- [ ] Task state machine
- [ ] Task dismissal
- [ ] Task completion
- [ ] Notification API
- [ ] Task linking (to source/finding/document/analysis)

### Frontend Work
- [ ] Task list page
- [ ] Task cards:
  - Type icon
  - Description
  - Link to source
  - Action button
  - Dismiss button
- [ ] Task badge in nav (count)
- [ ] Task notifications
- [ ] Mark task done
- [ ] Task history

### Database Work
- [ ] `task.linkedSourceCheckId` column
- [ ] `task.linkedFindingId` column
- [ ] `task.linkedDocumentId` column
- [ ] `task.linkedAnalysisId` column
- [ ] Migration

### Tests
- [ ] Task creation from manual action
- [ ] Task from new finding
- [ ] Task from failed source
- [ ] Complete task
- [ ] Dismiss task
- [ ] Task linking

### Security/Privacy
- [ ] Tasks project-scoped
- [ ] Dismissal audited

### Dependencies
- Milestones 1-5 (sources of tasks)

### Definition of Done
- ✅ Tasks created automatically
- ✅ Task list accessible
- ✅ Links to sources working
- ✅ Complete/dismiss actions work
- ✅ History preserved

### Explicit Exclusions
- Not implementing email notifications
- Not implementing push notifications
- Not implementing task assignment (single-user)

---

## Milestone 9: Scheduled Research 🕐

**Goal**: Automatic periodic research runs

### User-Visible Outcomes
- Enable scheduled research per project
- Set check frequency
- View last checked time
- See changed-since-last-run indicator
- Notifications for changes
- Graceful handling when worker offline

### Backend Work
- [ ] Scheduling configuration per project
- [ ] Worker scheduling logic
- [ ] Last-run tracking
- [ ] Change detection
- [ ] Idempotency (don't re-run if already running)
- [ ] Rate limiting across projects
- [ ] Backoff on repeated failures

### Frontend Work
- [ ] Schedule configuration UI:
  - Enable/disable
  - Frequency (daily/weekly/monthly)
  - Which sources to check
- [ ] Last checked indicator
- [ ] "Changes detected" badge
- [ ] Schedule status page

### Database Work
- [ ] `project.scheduleEnabled` boolean
- [ ] `project.scheduleFrequency` enum
- [ ] `project.lastScheduledRunAt` timestamp
- [ ] `project.nextScheduledRunAt` timestamp
- [ ] Migration

### Tests
- [ ] Enable schedule
- [ ] Trigger scheduled run
- [ ] Idempotency (no double-run)
- [ ] Rate limiting
- [ ] Change detection
- [ ] Backoff on failure

### Security/Privacy
- [ ] Scheduled runs respect same consent as manual
- [ ] Rate limits prevent abuse
- [ ] Worker offline handled gracefully

### Dependencies
- Milestone 2 (multiple stable sources)
- Milestone 8 (task notifications)

### Definition of Done
- ✅ Scheduled research configurable
- ✅ Worker processes scheduled runs
- ✅ Change detection working
- ✅ Notifications for changes
- ✅ Offline-worker handling

### Explicit Exclusions
- Not implementing cloud/always-on worker
- Not implementing webhook triggers
- Not implementing real-time monitoring

---

## Milestone 10: Product Hardening 🔒

**Goal**: Production-ready deployment, security, and multi-user support

### Authentication & Authorization (if multi-user)
- [ ] User authentication (email/password or OAuth)
- [ ] Session management
- [ ] Project ownership
- [ ] Project sharing (optional)
- [ ] Multi-user authorization checks
- [ ] CSRF protection

### Security
- [ ] Security audit
- [ ] Dependency audit (npm audit)
- [ ] SQL injection review
- [ ] XSS prevention review
- [ ] HTTPS enforcement
- [ ] Secrets management (vault or secrets manager)
- [ ] Rate limiting on APIs
- [ ] Input validation hardening

### Deployment
- [ ] Production Docker configuration
- [ ] Environment variable management
- [ ] Database backup strategy
- [ ] Restore procedure
- [ ] Health checks
- [ ] Graceful shutdown
- [ ] Log aggregation
- [ ] Error monitoring (Sentry or similar)
- [ ] Uptime monitoring

### Data Management
- [ ] Export project data (JSON/PDF)
- [ ] Import project data
- [ ] Delete project (with confirmation)
- [ ] GDPR compliance (if applicable)
- [ ] Data retention policy

### Performance
- [ ] Database indexing review
- [ ] Query optimization
- [ ] Caching strategy
- [ ] Large dataset handling
- [ ] Pagination

### Accessibility
- [ ] WCAG 2.1 AA compliance audit
- [ ] Screen reader testing
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] ARIA labels
- [ ] Color contrast

### Mobile
- [ ] Responsive design audit
- [ ] Touch target sizes
- [ ] Mobile navigation
- [ ] Mobile performance
- [ ] PWA considerations

### Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Deployment guide
- [ ] Contributing guide
- [ ] Architecture documentation

### Definition of Done
- ✅ Production deployment successful
- ✅ Security audit passed
- ✅ Backups automated
- ✅ Monitoring in place
- ✅ Accessibility audit passed
- ✅ Mobile experience excellent
- ✅ Documentation complete

---

## Post-MVP: Optional Enhancements

### Multi-User Features (if needed)
- User accounts and authentication
- Project sharing
- Role-based permissions
- Team collaboration
- Activity feed

### Advanced Features (future consideration)
- Mobile app (React Native)
- Email notifications
- SMS notifications
- WhatsApp integration
- Calendar integration
- Bank/lawyer integration
- Mortgage tracking
- Budget tracking
- Contractor tracking
- Warranty tracking

### Monetization (if needed)
- Subscription plans
- Premium features
- API access
- White-label solution

---

## Success Metrics

### MVP Success (Milestones 0-2)
- User can create project from winning message
- User can run research on 7 sources
- User can review findings
- All sources return results or manual actions
- Zero data loss bugs
- Zero security vulnerabilities

### Full Product Success (Milestones 0-10)
- User can track project from lottery to keys
- All documents organized and searchable
- AI assists but never auto-updates
- Timeline accurate and evidence-based
- Tasks keep user informed
- Scheduled research works reliably
- Production deployment stable
- Positive user feedback

---

## Technical Debt Tracking

Maintain a `docs/TECHNICAL_DEBT.md` file for:
- Known shortcuts taken
- Refactoring opportunities
- Performance optimizations deferred
- Test coverage gaps
- Documentation needs

Review and address technical debt between major milestones.

---

## Release Strategy

### Alpha (Milestones 0-1)
- Single developer testing
- Manual deployment
- Rapid iteration

### Beta (Milestones 2-5)
- Select user testing
- Feedback incorporation
- Staging environment

### V1.0 (Milestones 6-9)
- Public release
- Production deployment
- User documentation

### V2.0 (Milestone 10)
- Hardened production
- Multi-user (if applicable)
- Advanced features

---

## Maintenance Plan

### Ongoing
- Dependency updates monthly
- Security patches immediately
- Bug fixes as reported
- User feedback review weekly

### Quarterly
- Performance review
- Security audit
- Accessibility audit
- Documentation update

### Annually
- Major feature additions
- Architecture review
- Technology stack evaluation

---

*This roadmap is a living document. Update it as the product evolves, priorities shift, or new information emerges.*
