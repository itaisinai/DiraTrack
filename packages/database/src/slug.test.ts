import assert from "node:assert/strict";
import test from "node:test";
import { toProjectSlug } from "./slug.ts";

test("creates readable Hebrew project slugs", () => {
  assert.equal(toProjectSlug("  גני יהודה — הגרלה 2642  "), "גני-יהודה-הגרלה-2642");
});

test("rejects a slug without letters or numbers", () => {
  assert.throws(() => toProjectSlug("---"), /at least one letter or number/);
});
