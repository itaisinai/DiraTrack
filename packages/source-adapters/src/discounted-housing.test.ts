import assert from "node:assert/strict";
import test from "node:test";
import { DiscountedHousingAdapter, ManualActionRequired } from "./index.ts";

test("throws ManualActionRequired with lottery number details", async () => {
  const adapter = new DiscountedHousingAdapter();

  await assert.rejects(
    adapter.discover({
      project: { name: "פרויקט טסט", city: "יהוד", developer: null },
      identifiers: [{ type: "lottery-number", value: "2642" }],
    }),
    (error: unknown) => {
      if (!(error instanceof ManualActionRequired)) return false;
      assert.equal(error.action.searchValue, "2642");
      assert.match(error.action.explanation, /CAPTCHA/);
      assert.equal(error.action.sourceUrl, "https://www.dira.moch.gov.il/ProjectsList");
      return true;
    },
  );
});

test("throws ManualActionRequired when lottery number is missing", async () => {
  const adapter = new DiscountedHousingAdapter();

  await assert.rejects(
    adapter.discover({
      project: { name: "פרויקט ללא הגרלה", city: "תל אביב", developer: null },
      identifiers: [],
    }),
    (error: unknown) => {
      if (!(error instanceof ManualActionRequired)) return false;
      assert.match(error.message, /אין מספר הגרלה/);
      assert.equal(error.action.sourceUrl, "https://www.dira.moch.gov.il/ProjectsList");
      return true;
    },
  );
});

test("throws ManualActionRequired when lottery number is empty", async () => {
  const adapter = new DiscountedHousingAdapter();

  await assert.rejects(
    adapter.discover({
      project: { name: "פרויקט ריק", city: "חיפה", developer: null },
      identifiers: [{ type: "lottery-number", value: "  " }],
    }),
    ManualActionRequired,
  );
});
