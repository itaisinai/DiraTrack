CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'waiting-for-user', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('winning', 'planning', 'building-permit', 'apartment-selection-and-contract', 'construction', 'occupancy-approval', 'delivery');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"developer" text,
	"slug" text NOT NULL,
	"stage" "project_stage" DEFAULT 'winning' NOT NULL,
	"identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_jobs_status_created_at_idx" ON "research_jobs" USING btree ("status","created_at");