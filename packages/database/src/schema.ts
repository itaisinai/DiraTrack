import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const projectStageEnum = pgEnum("project_stage", [
  "winning",
  "planning",
  "building-permit",
  "apartment-selection-and-contract",
  "construction",
  "occupancy-approval",
  "delivery",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "verified",
  "unverified",
  "requires-review",
  "awaiting-approval",
  "conflict",
  "rejected",
]);

export const researchStatusEnum = pgEnum("research_status", [
  "pending",
  "running",
  "waiting-for-user",
  "completed",
  "completed-with-errors",
  "failed",
  "cancelled",
]);

export const sourceCheckStatusEnum = pgEnum("source_check_status", [
  "pending",
  "running",
  "results-found",
  "no-results",
  "waiting-for-user",
  "completed",
  "failed",
  "skipped",
]);

export const sourceCategoryEnum = pgEnum("source_category", [
  "official",
  "municipal",
  "developer",
  "private",
  "user-upload",
]);

export const identifierTypeEnum = pgEnum("identifier_type", [
  "lottery-number",
  "tender-number",
  "plan-number",
  "block",
  "parcel",
  "lot",
  "permit-request-number",
  "custom",
]);

export const identifierOriginEnum = pgEnum("identifier_origin", [
  "winning-message",
  "manual",
  "official-source",
  "research",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "remote-only",
  "downloading",
  "downloaded",
  "duplicate",
  "file-deleted",
  "failed",
]);

export const textExtractionStatusEnum = pgEnum("text_extraction_status", [
  "not-started",
  "extracting",
  "extracted",
  "ocr-required",
  "ocr-running",
  "failed",
]);

export const analysisStatusEnum = pgEnum("analysis_status", [
  "estimated",
  "approved-to-run",
  "running",
  "awaiting-approval",
  "approved",
  "rejected",
  "failed",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "completed",
  "in-progress",
  "waiting",
  "unknown",
  "requires-review",
]);

export const auditActorEnum = pgEnum("audit_actor", ["user", "system", "worker", "ai"]);

export const taskStatusEnum = pgEnum("task_status", ["open", "in-progress", "completed", "dismissed"]);

export const taskRelationTypeEnum = pgEnum("task_relation_type", ["source", "finding", "document", "analysis"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    isLocal: boolean("is_local").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_single_local_unique").on(table.isLocal).where(sql`${table.isLocal}`)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    city: text("city").notNull(),
    developer: text("developer"),
    currentSlug: text("current_slug").notNull(),
    stage: projectStageEnum("stage").notNull().default("winning"),
    operationalStatus: text("operational_status").notNull().default("תכנון ורישוי"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    unique("projects_id_owner_id_unique").on(table.id, table.ownerId),
    uniqueIndex("projects_current_slug_unique").on(table.currentSlug),
    index("projects_owner_id_idx").on(table.ownerId),
  ],
);

export const projectSlugs = pgTable(
  "project_slugs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("project_slugs_slug_unique").on(table.slug),
    uniqueIndex("project_slugs_one_current_per_project_unique").on(table.projectId).where(sql`${table.isCurrent}`),
    index("project_slugs_project_id_idx").on(table.projectId),
    check("project_slugs_current_not_retired_check", sql`not (${table.isCurrent} and ${table.retiredAt} is not null)`),
  ],
);

export const projectIdentifiers = pgTable(
  "project_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: identifierTypeEnum("type").notNull(),
    value: text("value").notNull(),
    origin: identifierOriginEnum("origin").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("unverified"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_identifiers_project_type_value_unique").on(table.projectId, table.type, table.value),
    index("project_identifiers_lookup_idx").on(table.type, table.value),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    category: sourceCategoryEnum("category").notNull(),
    baseUrl: text("base_url"),
    adapterKey: text("adapter_key"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sources_key_unique").on(table.key)],
);

export const projectSources = pgTable(
  "project_sources",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    searchConfiguration: jsonb("search_configuration").notNull().default({}),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.sourceId] })],
);

export const researchRuns = pgTable(
  "research_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    status: researchStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    requestedSources: jsonb("requested_sources").notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("research_runs_id_project_id_unique").on(table.id, table.projectId),
    index("research_runs_project_created_at_idx").on(table.projectId, table.createdAt),
    check("research_runs_progress_range_check", sql`${table.progress} between 0 and 100`),
  ],
);

export const sourceChecks = pgTable(
  "source_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    researchRunId: uuid("research_run_id").notNull(),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
    status: sourceCheckStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    error: text("error"),
    manualAction: jsonb("manual_action"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("source_checks_id_project_id_unique").on(table.id, table.projectId),
    foreignKey({
      columns: [table.researchRunId, table.projectId],
      foreignColumns: [researchRuns.id, researchRuns.projectId],
      name: "source_checks_run_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("source_checks_run_source_unique").on(table.researchRunId, table.sourceId),
    check("source_checks_progress_range_check", sql`${table.progress} between 0 and 100`),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sourceCheckId: uuid("source_check_id").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceUrl: text("source_url"),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("unverified"),
    isRelevant: boolean("is_relevant"),
    matchingIdentifiers: jsonb("matching_identifiers").notNull().default([]),
    rawMetadata: jsonb("raw_metadata").notNull().default({}),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("findings_id_project_id_unique").on(table.id, table.projectId),
    foreignKey({
      columns: [table.sourceCheckId, table.projectId],
      foreignColumns: [sourceChecks.id, sourceChecks.projectId],
      name: "findings_source_check_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("findings_project_source_external_unique").on(table.projectId, table.sourceCheckId, table.externalId),
    index("findings_project_verification_idx").on(table.projectId, table.verificationStatus),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sha256: text("sha256"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    remoteUrl: text("remote_url"),
    localPath: text("local_path"),
    status: documentStatusEnum("status").notNull().default("remote-only"),
    extractionStatus: textExtractionStatusEnum("extraction_status").notNull().default("not-started"),
    physicalFileDeletedAt: timestamp("physical_file_deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("documents_sha256_unique").on(table.sha256),
    check("documents_size_non_negative_check", sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`),
  ],
);

export const projectDocuments = pgTable(
  "project_documents",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "restrict" }),
    findingId: uuid("finding_id"),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("unverified"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.documentId] }),
    foreignKey({
      columns: [table.findingId, table.projectId],
      foreignColumns: [findings.id, findings.projectId],
      name: "project_documents_finding_project_fk",
    }).onDelete("restrict"),
  ],
);

export const documentPages = pgTable(
  "document_pages",
  {
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull(),
    wasOcr: boolean("was_ocr").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.pageNumber] }),
    check("document_pages_positive_page_check", sql`${table.pageNumber} > 0`),
  ],
);

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(),
    status: analysisStatusEnum("status").notNull().default("estimated"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
    actualCostUsd: numeric("actual_cost_usd", { precision: 12, scale: 6 }),
    result: jsonb("result"),
    warnings: jsonb("warnings").notNull().default([]),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("analyses_id_project_id_unique").on(table.id, table.projectId),
    foreignKey({
      columns: [table.projectId, table.documentId],
      foreignColumns: [projectDocuments.projectId, projectDocuments.documentId],
      name: "analyses_project_document_fk",
    }).onDelete("cascade"),
    index("analyses_project_status_idx").on(table.projectId, table.status),
  ],
);

export const analysisClaims = pgTable(
  "analysis_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").notNull(),
    claim: text("claim").notNull(),
    pageNumber: integer("page_number"),
    confidence: integer("confidence"),
    confidenceExplanation: text("confidence_explanation").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("awaiting-approval"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("analysis_claims_id_project_id_unique").on(table.id, table.projectId),
    foreignKey({
      columns: [table.analysisId, table.projectId],
      foreignColumns: [analyses.id, analyses.projectId],
      name: "analysis_claims_analysis_project_fk",
    }).onDelete("cascade"),
    check("analysis_claims_confidence_range_check", sql`${table.confidence} is null or ${table.confidence} between 0 and 100`),
  ],
);

export const analysisProposals = pgTable(
  "analysis_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").notNull(),
    proposedFacts: jsonb("proposed_facts").notNull().default([]),
    proposedTimelineChanges: jsonb("proposed_timeline_changes").notNull().default([]),
    potentialContradictions: jsonb("potential_contradictions").notNull().default([]),
    evidenceReferences: jsonb("evidence_references").notNull().default([]),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.analysisId, table.projectId],
      foreignColumns: [analyses.id, analyses.projectId],
      name: "analysis_proposals_analysis_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("analysis_proposals_one_per_analysis_unique").on(table.analysisId),
    check("analysis_proposals_not_applied_and_rejected_check", sql`not (${table.appliedAt} is not null and ${table.rejectedAt} is not null)`),
  ],
);

export const timelineTracks = pgTable(
  "timeline_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("timeline_tracks_id_project_id_unique").on(table.id, table.projectId),
    uniqueIndex("timeline_tracks_project_key_unique").on(table.projectId, table.key),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").notNull(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    status: milestoneStatusEnum("status").notNull().default("unknown"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    estimatedAt: timestamp("estimated_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("milestones_id_project_id_unique").on(table.id, table.projectId),
    foreignKey({
      columns: [table.trackId, table.projectId],
      foreignColumns: [timelineTracks.id, timelineTracks.projectId],
      name: "milestones_track_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("milestones_project_track_key_unique").on(table.projectId, table.trackId, table.key),
  ],
);

export const milestoneEvidence = pgTable(
  "milestone_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").notNull(),
    findingId: uuid("finding_id"),
    analysisClaimId: uuid("analysis_claim_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.milestoneId, table.projectId],
      foreignColumns: [milestones.id, milestones.projectId],
      name: "milestone_evidence_milestone_project_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.findingId, table.projectId],
      foreignColumns: [findings.id, findings.projectId],
      name: "milestone_evidence_finding_project_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.analysisClaimId, table.projectId],
      foreignColumns: [analysisClaims.id, analysisClaims.projectId],
      name: "milestone_evidence_analysis_claim_project_fk",
    }).onDelete("restrict"),
    check("milestone_evidence_has_source_check", sql`${table.findingId} is not null or ${table.analysisClaimId} is not null or ${table.note} is not null`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    actor: auditActorEnum("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_events_project_created_at_idx").on(table.projectId, table.createdAt)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    relationType: taskRelationTypeEnum("relation_type").notNull(),
    sourceId: uuid("source_id"),
    findingId: uuid("finding_id"),
    documentId: uuid("document_id"),
    analysisId: uuid("analysis_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.sourceId],
      foreignColumns: [projectSources.projectId, projectSources.sourceId],
      name: "tasks_project_source_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.findingId, table.projectId],
      foreignColumns: [findings.id, findings.projectId],
      name: "tasks_finding_project_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.projectId, table.documentId],
      foreignColumns: [projectDocuments.projectId, projectDocuments.documentId],
      name: "tasks_project_document_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.analysisId, table.projectId],
      foreignColumns: [analyses.id, analyses.projectId],
      name: "tasks_analysis_project_fk",
    }).onDelete("restrict"),
    index("tasks_project_status_idx").on(table.projectId, table.status),
    check(
      "tasks_exactly_one_relation_check",
      sql`num_nonnulls(${table.sourceId}, ${table.findingId}, ${table.documentId}, ${table.analysisId}) = 1`,
    ),
    check(
      "tasks_relation_type_matches_check",
      sql`(${table.relationType} = 'source' and ${table.sourceId} is not null) or (${table.relationType} = 'finding' and ${table.findingId} is not null) or (${table.relationType} = 'document' and ${table.documentId} is not null) or (${table.relationType} = 'analysis' and ${table.analysisId} is not null)`,
    ),
  ],
);

export const researchJobs = pgTable(
  "research_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    researchRunId: uuid("research_run_id"),
    status: researchStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    payload: jsonb("payload").notNull().default({}),
    attempts: integer("attempts").notNull().default(0),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.researchRunId, table.projectId],
      foreignColumns: [researchRuns.id, researchRuns.projectId],
      name: "research_jobs_run_project_fk",
    }).onDelete("cascade"),
    index("research_jobs_status_created_at_idx").on(table.status, table.createdAt),
    check("research_jobs_progress_range_check", sql`${table.progress} between 0 and 100`),
    check("research_jobs_attempts_non_negative_check", sql`${table.attempts} >= 0`),
  ],
);
