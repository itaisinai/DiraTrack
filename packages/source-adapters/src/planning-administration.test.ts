import assert from "node:assert/strict";
import test from "node:test";
import { PlanningAdministrationAdapter, ManualActionRequiredError } from "./index.ts";

test("directs plan number search to official Planning Administration site", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט 324", city: "יהוד", developer: "אסיה סיירוס" },
    identifiers: [{ type: "plan-number", value: "ב/2024/123" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.url, "https://www.gov.il/he/departments/iplan/govil-landing-page");
    assert.equal(error.action.searchValue, "ב/2024/123");
    assert.ok(error.action.title.includes("תוכנית ב/2024/123"));
    assert.ok(error.action.description.includes("תוכנית ב/2024/123"));
    assert.ok(!error.action.description.includes("פרויקט 324"));
    return true;
  });
});

test("searches by block and parcel when plan number is absent", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "block", value: "5000" },
      { type: "parcel", value: "12" },
      { type: "parcel", value: "34" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "גוש 5000 חלקה 12, 34");
    assert.ok(error.action.title.includes("גוש 5000 חלקה 12, 34"));
    assert.ok(error.action.description.includes("זיהוי גוש או חלקה תואמים אינו מספיק"));
    return true;
  });
});

test("deduplicates parcel numbers", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "block", value: "8000" },
      { type: "parcel", value: "22" },
      { type: "parcel", value: "22" },
      { type: "parcel", value: "44" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "גוש 8000 חלקה 22, 44");
    return true;
  });
});

test("ignores parcels when block is missing", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט בודד", city: "ירושלים", developer: null },
    identifiers: [{ type: "parcel", value: "99" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "ירושלים");
    assert.ok(!error.action.searchValue?.includes("חלקה"));
    return true;
  });
});

test("searches by permit request number when block and plan are absent", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "permit-request-number", value: "2024-999" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "2024-999");
    assert.ok(error.action.title.includes("בקשה להיתר 2024-999"));
    assert.ok(error.action.description.includes("לא כל שירותי החיפוש תומכים"));
    return true;
  });
});

test("falls back to city when specific identifiers are missing", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פארק המושבה", city: "פתח תקווה", developer: null },
    identifiers: [],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "פתח תקווה");
    assert.ok(error.action.title.includes("חיפוש רחב"));
    assert.ok(error.action.description.includes("חסרים מזהים מדויקים"));
    return true;
  });
});

test("explains when no city is available", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "", city: "", developer: null },
    identifiers: [],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, undefined);
    assert.ok(error.action.description.includes("חסרים מזהים למיקוד החיפוש"));
    return true;
  });
});

test("prioritizes plan number over block and parcel", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "plan-number", value: "ג/555/ה" },
      { type: "block", value: "1234" },
      { type: "parcel", value: "56" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "ג/555/ה");
    assert.ok(error.action.title.includes("תוכנית ג/555/ה"));
    return true;
  });
});

test("prioritizes block and parcel over permit request number", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "block", value: "7000" },
      { type: "parcel", value: "88" },
      { type: "permit-request-number", value: "2024-001" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "גוש 7000 חלקה 88");
    assert.ok(error.action.title.includes("גוש 7000 חלקה 88"));
    return true;
  });
});

test("trims whitespace from identifiers", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "plan-number", value: "  א/100/ב  " }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "א/100/ב");
    return true;
  });
});

test("does not include project name or developer in manual action", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט פרטי עם שם רגיש", city: "תל אביב", developer: "יזם פרטי" },
    identifiers: [{ type: "plan-number", value: "ת/2024/1" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.ok(!error.action.title.includes("פרויקט פרטי עם שם רגיש"));
    assert.ok(!error.action.title.includes("יזם פרטי"));
    assert.ok(!error.action.description.includes("יזם פרטי"));
    return true;
  });
});

test("uses official government URL", async () => {
  const adapter = new PlanningAdministrationAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "plan-number", value: "מ/100" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.ok(error.action.url.startsWith("https://www.gov.il/"));
    assert.ok(error.action.url.includes("iplan"));
    return true;
  });
});
