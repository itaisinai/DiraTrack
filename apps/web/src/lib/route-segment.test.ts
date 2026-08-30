import assert from "node:assert/strict";
import test from "node:test";
import { encodeRouteSegment } from "./route-segment.ts";

test("encodes a raw Hebrew route segment exactly once", () => {
  assert.equal(encodeRouteSegment("פרויקט-324"), "%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98-324");
});

test("does not double-encode a segment returned by useParams", () => {
  assert.equal(encodeRouteSegment("%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98-324"), "%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98-324");
});
