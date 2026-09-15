import assert from "node:assert/strict";
import test from "node:test";
import { ManualActionRequiredError, YehudLocalPlanningAdapter, getSourceAdapter, sourceRequiresManualAction, sourceSendsExternalData, type SourceResearchContext } from "./index.ts";

const project = { name: "גני יהודה", city: "יהוד", developer: "אסיה סיירוס" };

async function getManualAction(identifiers: Array<{ type: string; value: string }>, projectOverride: SourceResearchContext["project"] = project) {
  const adapter = new YehudLocalPlanningAdapter();
  try {
    await adapter.discover({ project: projectOverride, identifiers });
    assert.fail("expected a manual action");
  } catch (error) {
    assert.ok(error instanceof ManualActionRequiredError);
    return error.action;
  }
}

test("prioritizes a plan number over all other identifiers", async () => {
  const action = await getManualAction([
    { type: "block", value: "6500" },
    { type: "permit-request-number", value: "2026-1" },
    { type: "plan-number", value: "  123-4567890  " },
  ]);

  assert.equal(action.url, "https://yehud.bartech-net.co.il/");
  assert.equal(action.searchValue, "123-4567890");
  assert.match(action.description, /לאמת את הקשר לפרויקט/);
});

test("uses a permit request before cadastral identifiers without claiming a permit", async () => {
  const action = await getManualAction([
    { type: "block", value: "6500" },
    { type: "permit-request-number", value: "2026-1" },
  ]);

  assert.equal(action.searchValue, "2026-1");
  assert.match(action.description, /אינה מאמתת היתר/);
});

test("combines a block with unique non-empty parcels", async () => {
  const action = await getManualAction([
    { type: "block", value: "6500" },
    { type: "parcel", value: "71" },
    { type: "parcel", value: " 71 " },
    { type: "parcel", value: "78" },
    { type: "parcel", value: "" },
  ]);

  assert.equal(action.searchValue, "גוש 6500, חלקות 71, 78");
  assert.match(action.description, /אינה מוכיחה/);
});

test("uses a lot with city only after stronger identifiers are absent", async () => {
  const action = await getManualAction([{ type: "lot", value: "324" }]);
  assert.equal(action.searchValue, "מגרש 324, יהוד");
  assert.match(action.description, /לא ייחודי/);
});

test("explains that a city-only search is broad", async () => {
  const action = await getManualAction([
    { type: "registrant-number", value: "973999" },
    { type: "queue-position", value: "63" },
  ]);

  assert.equal(action.searchValue, "יהוד");
  assert.match(action.description, /חיפוש רחב/);
  assert.equal(JSON.stringify(action).includes("973999"), false);
  assert.equal(JSON.stringify(action).includes("63"), false);
});

test("requests identifiers when no useful project context exists", async () => {
  const action = await getManualAction([], { name: "", city: "", developer: null });
  assert.equal(action.searchValue, undefined);
  assert.match(action.description, /יש להוסיף/);
});

test("registers the committee as an implemented manual source with no automatic disclosure", () => {
  assert.ok(getSourceAdapter("yehud-local-planning") instanceof YehudLocalPlanningAdapter);
  assert.equal(sourceRequiresManualAction("yehud-local-planning"), true);
  assert.equal(sourceSendsExternalData("yehud-local-planning"), false);
});
