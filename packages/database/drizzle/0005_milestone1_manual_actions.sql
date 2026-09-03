-- Migration: Add manual action tracking columns to source_checks
-- Date: 2026-09-02
-- Description: Add lastCheckedAt, dismissedAt, and dismissedReason columns to support Milestone 1 manual action workflow

ALTER TABLE "source_checks" ADD COLUMN "last_checked_at" timestamp with time zone;
ALTER TABLE "source_checks" ADD COLUMN "dismissed_at" timestamp with time zone;
ALTER TABLE "source_checks" ADD COLUMN "dismissed_reason" text;

-- Create index on dismissedAt for filtering dismissed/active checks
CREATE INDEX "source_checks_dismissed_at_idx" ON "source_checks" ("dismissed_at");

-- Create index on lastCheckedAt for sorting by recency
CREATE INDEX "source_checks_last_checked_at_idx" ON "source_checks" ("last_checked_at");
