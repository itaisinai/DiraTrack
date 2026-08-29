import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import {
  analyses,
  analysisClaims,
  findings,
  milestones,
  projectDocuments,
  sourceChecks,
  tasks,
} from "./schema.ts";

function foreignKeyColumns(table: PgTable, name: string) {
  const foreignKey = getTableConfig(table).foreignKeys.find((candidate) => candidate.getName() === name);
  assert.ok(foreignKey, `missing foreign key ${name}`);

  const reference = foreignKey.reference();
  return {
    local: reference.columns.map((column) => column.name),
    foreign: reference.foreignColumns.map((column) => column.name),
  };
}

test("research entities cannot reference a run or finding from another project", () => {
  assert.deepEqual(foreignKeyColumns(sourceChecks, "source_checks_run_project_fk"), {
    local: ["research_run_id", "project_id"],
    foreign: ["id", "project_id"],
  });
  assert.deepEqual(foreignKeyColumns(findings, "findings_source_check_project_fk"), {
    local: ["source_check_id", "project_id"],
    foreign: ["id", "project_id"],
  });
});

test("documents, analyses, and claims retain project isolation", () => {
  assert.deepEqual(foreignKeyColumns(projectDocuments, "project_documents_finding_project_fk"), {
    local: ["finding_id", "project_id"],
    foreign: ["id", "project_id"],
  });
  assert.deepEqual(foreignKeyColumns(analyses, "analyses_project_document_fk"), {
    local: ["project_id", "document_id"],
    foreign: ["project_id", "document_id"],
  });
  assert.deepEqual(foreignKeyColumns(analysisClaims, "analysis_claims_analysis_project_fk"), {
    local: ["analysis_id", "project_id"],
    foreign: ["id", "project_id"],
  });
});

test("timeline and task relations are scoped to the same project", () => {
  assert.deepEqual(foreignKeyColumns(milestones, "milestones_track_project_fk"), {
    local: ["track_id", "project_id"],
    foreign: ["id", "project_id"],
  });
  assert.deepEqual(foreignKeyColumns(tasks, "tasks_analysis_project_fk"), {
    local: ["analysis_id", "project_id"],
    foreign: ["id", "project_id"],
  });
});
