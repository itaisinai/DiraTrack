import assert from "node:assert/strict";
import test from "node:test";
import { DiscountedHousingAdapter, ManualActionRequiredError } from "./index.ts";

test("directs a lottery search to the official project list without fabricating a discovery", async () => {
  const adapter = new DiscountedHousingAdapter();
  const context = { project: { name: "פרויקט 324", city: "יהוד", developer: "אסיה סיירוס" }, identifiers: [{ type: "lottery-number", value: "2642" }] };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.url, "https://www.dira.moch.gov.il/ProjectsList");
    assert.equal(error.action.searchValue, "2642");
    return true;
  });
});

test("explains when a project has no lottery number", async () => {
  const adapter = new DiscountedHousingAdapter();
  await assert.rejects(adapter.discover({ project: { name: "פרויקט", city: "יהוד", developer: null }, identifiers: [] }), (error: unknown) => error instanceof ManualActionRequiredError && error.action.searchValue === undefined && error.action.description.includes("חסר מספר הגרלה"));
});
