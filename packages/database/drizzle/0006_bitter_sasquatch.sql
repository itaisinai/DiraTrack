CREATE TYPE "public"."source_error_category" AS ENUM('timeout', 'rate-limit', 'access-denied', 'captcha-required', 'invalid-response', 'network-error', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_health_status" AS ENUM('healthy', 'degraded', 'unavailable', 'manual-only', 'not-checked');--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "health_status" "source_health_status" DEFAULT 'not-checked' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_error_category" "source_error_category";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_error_message" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "timeout_ms" integer DEFAULT 20000 NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "retry_policy" jsonb;--> statement-breakpoint
CREATE INDEX "sources_health_status_idx" ON "sources" USING btree ("health_status");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_timeout_positive_check" CHECK ("sources"."timeout_ms" > 0);