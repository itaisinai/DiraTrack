import assert from "node:assert/strict";
import test from "node:test";
import { startResearchRun } from "./research.ts";

test("an explicit empty source list never expands to all research sources", async () => {
  await assert.rejects(
    startResearchRun(null as never, "project-id", []),
    /No enabled research sources were selected/,
  );
});
