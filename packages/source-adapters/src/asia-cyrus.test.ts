import assert from "node:assert/strict";
import test from "node:test";
import { AsiaCyrusAdapter } from "./index.ts";

test("searches the live source using project data and keeps evidence unverified", async () => {
  const requestedTerms: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const term = url.searchParams.get("search") ?? "";
    requestedTerms.push(term);
    const results = term === "6500" ? [{ id: 42, title: "עמוד &amp; בדיקה", url: "https://asia-cyrus.co.il/example", type: "post", subtype: "page" }] : [];
    return new Response(JSON.stringify(results), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const adapter = new AsiaCyrusAdapter(fetcher);

  const results = await adapter.discover({
    project: { name: "גני יהודה", city: "יהוד־מונוסון", developer: "אסיה סיירוס" },
    identifiers: [{ type: "block", value: "6500" }],
  });

  assert.deepEqual(requestedTerms, ["גני יהודה", "יהוד־מונוסון", "6500"]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.title, "עמוד & בדיקה");
  assert.deepEqual(results[0]?.matchingIdentifiers, [{ type: "block", value: "6500" }]);
  assert.match(results[0]?.summary ?? "", /לפתוח את המקור ולאמת/);
});

test("fails explicitly when the source does not return a successful response", async () => {
  const adapter = new AsiaCyrusAdapter(async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(
    adapter.discover({ project: { name: "פרויקט", city: "עיר", developer: null }, identifiers: [] }),
    /HTTP 503/,
  );
});
