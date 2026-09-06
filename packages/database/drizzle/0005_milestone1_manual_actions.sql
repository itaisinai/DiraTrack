ALTER TABLE "source_checks" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_checks" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_checks" ADD COLUMN "dismissed_reason" text;--> statement-breakpoint
CREATE INDEX "source_checks_dismissed_at_idx" ON "source_checks" USING btree ("dismissed_at");--> statement-breakpoint
CREATE INDEX "source_checks_last_checked_at_idx" ON "source_checks" USING btree ("last_checked_at");