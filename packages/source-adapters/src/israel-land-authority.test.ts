import assert from "node:assert/strict";
import test from "node:test";
import { IsraelLandAuthorityAdapter, ManualActionRequiredError } from "./index.ts";

test("directs tender number search to official ILA site", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט 324", city: "יהוד", developer: "אסיה סיירוס" },
    identifiers: [{ type: "tender-number", value: "12345" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.url, "https://www.gov.il/he/departments/israel_land_authority/govil-landing-page");
    assert.equal(error.action.searchValue, "12345");
    assert.ok(error.action.title.includes("מכרז 12345"));
    assert.ok(error.action.description.includes("מכרז 12345"));
    assert.ok(!error.action.description.includes("פרויקט 324"));
    return true;
  });
});

test("prioritizes tender number over lot number", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "tender-number", value: "99999" },
      { type: "lot", value: "555" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "99999");
    assert.ok(error.action.title.includes("מכרז"));
    return true;
  });
});

test("searches by lot number when tender is absent", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "lot", value: "777" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "777");
    assert.ok(error.action.title.includes("מגרש 777"));
    return true;
  });
});

test("searches by block and parcel when lot is absent", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "block", value: "1234" },
      { type: "parcel", value: "56" },
      { type: "parcel", value: "78" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "גוש 1234 חלקה 56, 78");
    assert.ok(error.action.title.includes("גוש 1234 חלקה 56, 78"));
    assert.ok(error.action.description.includes("אינו מספיק כדי לקשר באופן ודאי"));
    return true;
  });
});

test("deduplicates parcel numbers", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [
      { type: "block", value: "9000" },
      { type: "parcel", value: "12" },
      { type: "parcel", value: "12" },
      { type: "parcel", value: "34" },
    ],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "גוש 9000 חלקה 12, 34");
    return true;
  });
});

test("ignores parcels when block is missing", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט בודד", city: "ירושלים", developer: null },
    identifiers: [{ type: "parcel", value: "99" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.ok(error.action.searchValue?.includes("פרויקט בודד"));
    assert.ok(!error.action.searchValue?.includes("חלקה"));
    return true;
  });
});

test("searches by housing project number when block and lot are absent", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "housing-project-number", value: "HP-2024-001" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "HP-2024-001");
    assert.ok(error.action.title.includes("פרויקט דיור HP-2024-001"));
    return true;
  });
});

test("falls back to project name and city when identifiers are missing", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פארק המושבה", city: "פתח תקווה", developer: null },
    identifiers: [],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "פארק המושבה פתח תקווה");
    assert.ok(error.action.title.includes("חיפוש רחב"));
    assert.ok(error.action.description.includes("חסרים מזהים מדויקים"));
    return true;
  });
});

test("explains when no identifiers and no project name are available", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
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

test("trims whitespace from identifiers", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "tender-number", value: "  88888  " }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.equal(error.action.searchValue, "88888");
    return true;
  });
});

test("does not include project name in manual action title", async () => {
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט פרטי עם שם רגיש", city: "תל אביב", developer: "יזם פרטי" },
    identifiers: [{ type: "lot", value: "123" }],
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
  const adapter = new IsraelLandAuthorityAdapter();
  const context = {
    project: { name: "פרויקט", city: "תל אביב", developer: null },
    identifiers: [{ type: "tender-number", value: "123" }],
  };
  await assert.rejects(adapter.discover(context), (error: unknown) => {
    assert.ok(error instanceof ManualActionRequiredError);
    assert.ok(error.action.url.startsWith("https://www.gov.il/"));
    assert.ok(error.action.url.includes("israel_land_authority"));
    return true;
  });
});
