import assert from "node:assert/strict";
import test from "node:test";
import { ManualActionRequiredError, YehudMonossonAdapter, getSourceAdapter } from "./index.ts";

const project = { name: "גני יהודה", city: "יהוד", developer: "אסיה סיירוס" };

test("searches the official municipal API using only focused public project data", async () => {
  const requestedTerms: string[] = [];
  const adapter = new YehudMonossonAdapter(async (input) => {
    const url = new URL(input.toString());
    requestedTerms.push(url.searchParams.get("search") ?? "");
    return Response.json([]);
  });

  await adapter.discover({
    project,
    identifiers: [
      { type: "block", value: "6500" },
      { type: "parcel", value: "71" },
      { type: "registrant-number", value: "973999" },
      { type: "queue-position", value: "63" },
    ],
  });

  assert.deepEqual(requestedTerms, ["גני יהודה", "אסיה סיירוס", "גוש 6500", "חלקה 71"]);
  assert.equal(requestedTerms.some((term) => term.includes("973999") || term === "יהוד"), false);
});

test("merges duplicate results and keeps only identifier-backed matches", async () => {
  const adapter = new YehudMonossonAdapter(async () => Response.json([{
    id: 42,
    title: "עדכון &amp; הודעה",
    url: "https://yehud-monosson.muni.il/news/42",
    type: "post",
    subtype: "post",
  }]));

  const discoveries = await adapter.discover({ project, identifiers: [{ type: "block", value: "6500" }] });

  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0]?.title, "עדכון & הודעה");
  assert.deepEqual(discoveries[0]?.matchingIdentifiers, [{ type: "block", value: "6500" }]);
  assert.deepEqual(discoveries[0]?.metadata.matchedTerms, ["שם הפרויקט: גני יהודה", "יזם: אסיה סיירוס", "גוש 6500"]);
  assert.match(discoveries[0]?.summary ?? "", /לאמת/);
});

test("ignores malformed and off-domain search results", async () => {
  const adapter = new YehudMonossonAdapter(async () => Response.json([
    { id: 1, title: "External", url: "https://example.com/item", type: "post", subtype: "post" },
    { id: 2, title: "Wrong type", url: "https://yehud-monosson.muni.il/item", type: "term", subtype: "category" },
    { unexpected: true },
  ]));

  assert.deepEqual(await adapter.discover({ project, identifiers: [] }), []);
});

test("requires a manual check when the official API rate-limits the worker", async () => {
  const adapter = new YehudMonossonAdapter(async () => new Response(null, { status: 429 }));

  await assert.rejects(adapter.discover({ project, identifiers: [] }), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.url, "https://yehud-monosson.muni.il/");
    assert.equal(error.action.searchValue, "גני יהודה");
    return true;
  });
});

test("fails safely on server and invalid response errors", async (t) => {
  await t.test("server error", async () => {
    const adapter = new YehudMonossonAdapter(async () => new Response(null, { status: 503 }));
    await assert.rejects(adapter.discover({ project, identifiers: [] }), /HTTP 503/);
  });

  await t.test("invalid payload", async () => {
    const adapter = new YehudMonossonAdapter(async () => Response.json({ results: [] }));
    await assert.rejects(adapter.discover({ project, identifiers: [] }), /invalid response/);
  });
});

test("registers the municipality source adapter", () => {
  assert.ok(getSourceAdapter("yehud-monosson") instanceof YehudMonossonAdapter);
});
