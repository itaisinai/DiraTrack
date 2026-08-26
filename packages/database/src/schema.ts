import { index, jsonb, pgEnum, pgTable, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectStageEnum = pgEnum("project_stage", ["winning", "planning", "building-permit", "apartment-selection-and-contract", "construction", "occupancy-approval", "delivery"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "waiting-for-user", "completed", "failed"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), city: text("city").notNull(), developer: text("developer"),
  slug: text("slug").notNull().unique(), stage: projectStageEnum("stage").notNull().default("winning"), identifiers: jsonb("identifiers").notNull().default({}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(), updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const researchJobs = pgTable("research_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id, {onDelete: "cascade"}),
  status: jobStatusEnum("status").notNull().default("pending"), progress: integer("progress").notNull().default(0), payload: jsonb("payload").notNull().default({}),
  error: text("error"), createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(), startedAt: timestamp("started_at", {withTimezone: true}), completedAt: timestamp("completed_at", {withTimezone: true}),
}, (table) => [index("research_jobs_status_created_at_idx").on(table.status, table.createdAt)]);
