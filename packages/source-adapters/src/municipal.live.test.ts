import assert from "node:assert/strict";
import test from "node:test";

const liveEnabled = process.env.LIVE_API_TESTS === "1";

test("municipality WordPress search returns a compatible public response", { skip: !liveEnabled }, async () => {
  const endpoint = new URL("https://yehud-monosson.muni.il/wp-json/wp/v2/search");
  endpoint.searchParams.set("search", "גוש 6500");
  endpoint.searchParams.set("per_page", "1");
  endpoint.searchParams.set("type", "post");
  endpoint.searchParams.set("_fields", "id,title,url,type,subtype");

  const response = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "DiraTrack/0.1 live-smoke-test" }, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `municipality returned HTTP ${response.status}`);
  assert.ok(Array.isArray(await response.json()));
});

test("local planning committee landing page is reachable", { skip: !liveEnabled }, async () => {
  const response = await fetch("https://yehud.bartech-net.co.il/", { headers: { "User-Agent": "DiraTrack/0.1 live-smoke-test" }, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `committee returned HTTP ${response.status}`);
});
