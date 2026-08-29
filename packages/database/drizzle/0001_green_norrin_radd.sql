CREATE TYPE "public"."analysis_status" AS ENUM('estimated', 'approved-to-run', 'running', 'awaiting-approval', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor" AS ENUM('user', 'system', 'worker', 'ai');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('remote-only', 'downloading', 'downloaded', 'duplicate', 'file-deleted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."identifier_origin" AS ENUM('winning-message', 'manual', 'official-source', 'research');--> statement-breakpoint
CREATE TYPE "public"."identifier_type" AS ENUM('lottery-number', 'tender-number', 'plan-number', 'block', 'parcel', 'lot', 'permit-request-number', 'custom');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('completed', 'in-progress', 'waiting', 'unknown', 'requires-review');--> statement-breakpoint
CREATE TYPE "public"."research_status" AS ENUM('pending', 'running', 'waiting-for-user', 'completed', 'completed-with-errors', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_category" AS ENUM('official', 'municipal', 'developer', 'private', 'user-upload');--> statement-breakpoint
CREATE TYPE "public"."source_check_status" AS ENUM('pending', 'running', 'results-found', 'no-results', 'waiting-for-user', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."task_relation_type" AS ENUM('source', 'finding', 'document', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in-progress', 'completed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."text_extraction_status" AS ENUM('not-started', 'extracting', 'extracted', 'ocr-required', 'ocr-running', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'unverified', 'requires-review', 'awaiting-approval', 'conflict', 'rejected');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "analysis_status" DEFAULT 'estimated' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 6),
	"actual_cost_usd" numeric(12, 6),
	"result" jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_id_project_id_unique" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"page_number" integer,
	"confidence" integer,
	"confidence_explanation" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'awaiting-approval' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_claims_id_project_id_unique" UNIQUE("id","project_id"),
	CONSTRAINT "analysis_claims_confidence_range_check" CHECK ("analysis_claims"."confidence" is null or "analysis_claims"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "analysis_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"proposed_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposed_timeline_changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"potential_contradictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_proposals_not_applied_and_rejected_check" CHECK (not ("analysis_proposals"."applied_at" is not null and "analysis_proposals"."rejected_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"actor" "audit_actor" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text" text NOT NULL,
	"was_ocr" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_pages_document_id_page_number_pk" PRIMARY KEY("document_id","page_number"),
	CONSTRAINT "document_pages_positive_page_check" CHECK ("document_pages"."page_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" text,
	"original_name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"remote_url" text,
	"local_path" text,
	"status" "document_status" DEFAULT 'remote-only' NOT NULL,
	"extraction_status" text_extraction_status DEFAULT 'not-started' NOT NULL,
	"physical_file_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_size_non_negative_check" CHECK ("documents"."size_bytes" is null or "documents"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_check_id" uuid NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_url" text,
	"source_published_at" timestamp with time zone,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"is_relevant" boolean,
	"matching_identifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_id_project_id_unique" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "milestone_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"finding_id" uuid,
	"analysis_claim_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_evidence_has_source_check" CHECK ("milestone_evidence"."finding_id" is not null or "milestone_evidence"."analysis_claim_id" is not null or "milestone_evidence"."note" is not null)
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"status" "milestone_status" DEFAULT 'unknown' NOT NULL,
	"occurred_at" timestamp with time zone,
	"estimated_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_id_project_id_unique" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"finding_id" uuid,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_documents_project_id_document_id_pk" PRIMARY KEY("project_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "project_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "identifier_type" NOT NULL,
	"value" text NOT NULL,
	"origin" "identifier_origin" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "project_slugs_current_not_retired_check" CHECK (not ("project_slugs"."is_current" and "project_slugs"."retired_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "project_sources" (
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"search_configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sources_project_id_source_id_pk" PRIMARY KEY("project_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "research_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"requested_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_runs_id_project_id_unique" UNIQUE("id","project_id"),
	CONSTRAINT "research_runs_progress_range_check" CHECK ("research_runs"."progress" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "source_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"research_run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "source_check_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"manual_action" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_checks_id_project_id_unique" UNIQUE("id","project_id"),
	CONSTRAINT "source_checks_progress_range_check" CHECK ("source_checks"."progress" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" "source_category" NOT NULL,
	"base_url" text,
	"adapter_key" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"relation_type" "task_relation_type" NOT NULL,
	"source_id" uuid,
	"finding_id" uuid,
	"document_id" uuid,
	"analysis_id" uuid,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_exactly_one_relation_check" CHECK (num_nonnulls("tasks"."source_id", "tasks"."finding_id", "tasks"."document_id", "tasks"."analysis_id") = 1),
	CONSTRAINT "tasks_relation_type_matches_check" CHECK (("tasks"."relation_type" = 'source' and "tasks"."source_id" is not null) or ("tasks"."relation_type" = 'finding' and "tasks"."finding_id" is not null) or ("tasks"."relation_type" = 'document' and "tasks"."document_id" is not null) or ("tasks"."relation_type" = 'analysis' and "tasks"."analysis_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "timeline_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timeline_tracks_id_project_id_unique" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"is_local" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_slug_unique";--> statement-breakpoint
ALTER TABLE "research_jobs" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "research_jobs" ALTER COLUMN "status" SET DATA TYPE "public"."research_status" USING "status"::text::"public"."research_status";--> statement-breakpoint
ALTER TABLE "research_jobs" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "current_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "operational_status" text DEFAULT 'תכנון ורישוי' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "research_run_id" uuid;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_project_document_fk" FOREIGN KEY ("project_id","document_id") REFERENCES "public"."project_documents"("project_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_claims" ADD CONSTRAINT "analysis_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_claims" ADD CONSTRAINT "analysis_claims_analysis_project_fk" FOREIGN KEY ("analysis_id","project_id") REFERENCES "public"."analyses"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_proposals" ADD CONSTRAINT "analysis_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_proposals" ADD CONSTRAINT "analysis_proposals_analysis_project_fk" FOREIGN KEY ("analysis_id","project_id") REFERENCES "public"."analyses"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_source_check_project_fk" FOREIGN KEY ("source_check_id","project_id") REFERENCES "public"."source_checks"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_milestone_project_fk" FOREIGN KEY ("milestone_id","project_id") REFERENCES "public"."milestones"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_finding_project_fk" FOREIGN KEY ("finding_id","project_id") REFERENCES "public"."findings"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_analysis_claim_project_fk" FOREIGN KEY ("analysis_claim_id","project_id") REFERENCES "public"."analysis_claims"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_track_project_fk" FOREIGN KEY ("track_id","project_id") REFERENCES "public"."timeline_tracks"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_finding_project_fk" FOREIGN KEY ("finding_id","project_id") REFERENCES "public"."findings"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_identifiers" ADD CONSTRAINT "project_identifiers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_slugs" ADD CONSTRAINT "project_slugs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checks" ADD CONSTRAINT "source_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checks" ADD CONSTRAINT "source_checks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checks" ADD CONSTRAINT "source_checks_run_project_fk" FOREIGN KEY ("research_run_id","project_id") REFERENCES "public"."research_runs"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_source_fk" FOREIGN KEY ("project_id","source_id") REFERENCES "public"."project_sources"("project_id","source_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_finding_project_fk" FOREIGN KEY ("finding_id","project_id") REFERENCES "public"."findings"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_document_fk" FOREIGN KEY ("project_id","document_id") REFERENCES "public"."project_documents"("project_id","document_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_analysis_project_fk" FOREIGN KEY ("analysis_id","project_id") REFERENCES "public"."analyses"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_tracks" ADD CONSTRAINT "timeline_tracks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_project_status_idx" ON "analyses" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_proposals_one_per_analysis_unique" ON "analysis_proposals" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "audit_events_project_created_at_idx" ON "audit_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sha256_unique" ON "documents" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_project_source_external_unique" ON "findings" USING btree ("project_id","source_check_id","external_id");--> statement-breakpoint
CREATE INDEX "findings_project_verification_idx" ON "findings" USING btree ("project_id","verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_project_track_key_unique" ON "milestones" USING btree ("project_id","track_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_identifiers_project_type_value_unique" ON "project_identifiers" USING btree ("project_id","type","value");--> statement-breakpoint
CREATE INDEX "project_identifiers_lookup_idx" ON "project_identifiers" USING btree ("type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "project_slugs_slug_unique" ON "project_slugs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "project_slugs_one_current_per_project_unique" ON "project_slugs" USING btree ("project_id") WHERE "project_slugs"."is_current";--> statement-breakpoint
CREATE INDEX "project_slugs_project_id_idx" ON "project_slugs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_runs_project_created_at_idx" ON "research_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_checks_run_source_unique" ON "source_checks" USING btree ("research_run_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_unique" ON "sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "tasks_project_status_idx" ON "tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_tracks_project_key_unique" ON "timeline_tracks" USING btree ("project_id","key");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_run_project_fk" FOREIGN KEY ("research_run_id","project_id") REFERENCES "public"."research_runs"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_current_slug_unique" ON "projects" USING btree ("current_slug");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "identifiers";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_owner_id_unique" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_progress_range_check" CHECK ("research_jobs"."progress" between 0 and 100);--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_attempts_non_negative_check" CHECK ("research_jobs"."attempts" >= 0);--> statement-breakpoint
DROP TYPE "public"."job_status";