import assert from "node:assert/strict";
import test from "node:test";
import { parseWinningMessage } from "./winning-message-parser.ts";

const message = `מספר נרשם:111111

שלום רב,

במסגרת תוכנית "דירה בהנחה" זכית בהגרלה מספר 2642 לפרויקט 324 של קבלן אסיה סיירוס פיתוח וייזום בע"מ
ביישוב יהוד
נקבע כי מקומך לבחירת דירה הוא 63. בהגרלה זו הוצעו 118 דירות.

פרטים נוספים באתר:
[https://www.dira.moch.gov.il/ProjectsList](https://www.dira.moch.gov.il/ProjectsList)`;

test("extracts structured project data from a winning message", () => {
  const parsed = parseWinningMessage(message);

  assert.equal(parsed.lotteryNumber?.value, "2642");
  assert.equal(parsed.housingProjectNumber?.value, "324");
  assert.equal(parsed.developer?.value, "אסיה סיירוס פיתוח וייזום בע\"מ");
  assert.equal(parsed.city?.value, "יהוד");
  assert.equal(parsed.selectionPosition?.value, "63");
  assert.equal(parsed.offeredApartments?.value, "118");
  assert.equal(parsed.sourceUrl?.value, "https://www.dira.moch.gov.il/ProjectsList");
  assert.equal(parsed.containsRegistrantNumber, true);
});

test("does not return or retain the personal registrant number", () => {
  const parsed = parseWinningMessage(message);
  assert.doesNotMatch(JSON.stringify(parsed), /111111/);
});

test("returns only fields that are actually present", () => {
  assert.deepEqual(parseWinningMessage("זכית בהגרלה מספר 9876"), {
    lotteryNumber: { value: "9876", evidence: "הגרלה מספר 9876" },
    housingProjectNumber: undefined,
    developer: undefined,
    city: undefined,
    selectionPosition: undefined,
    offeredApartments: undefined,
    sourceUrl: undefined,
    containsRegistrantNumber: false,
  });
});
