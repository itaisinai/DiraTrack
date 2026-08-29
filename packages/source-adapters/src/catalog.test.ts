import assert from "node:assert/strict";
import test from "node:test";
import { mvpSourceCatalog } from "./index.ts";

test("the MVP catalog contains only the approved seven sources", () => {
  assert.deepEqual(
    mvpSourceCatalog.map((source) => source.name),
    [
      "דירה בהנחה",
      "רשות מקרקעי ישראל",
      "מינהל התכנון",
      "הוועדה המקומית יהוד־מונוסון",
      "אתר עיריית יהוד־מונוסון",
      "אתר אסיה סיירוס",
      "מסמכים שהמשתמש העלה",
    ],
  );
});
