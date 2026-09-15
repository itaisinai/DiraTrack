import { ManualActionRequiredError, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";

export class PlanningAdministrationAdapter implements SourceAdapter {
  readonly id = "planning-administration";

  async discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]> {
    const planNumber = context.identifiers.find((id) => id.type === "plan-number")?.value.trim();
    const block = context.identifiers.find((id) => id.type === "block")?.value.trim();
    const parcels = context.identifiers.filter((id) => id.type === "parcel").map((id) => id.value.trim()).filter((v) => v);
    const uniqueParcels = [...new Set(parcels)];
    const permitRequestNumber = context.identifiers.find((id) => id.type === "permit-request-number")?.value.trim();
    const city = context.project.city.trim();

    let title: string;
    let searchValue: string | undefined;
    let description: string;

    if (planNumber) {
      title = `חיפוש תוכנית ${planNumber} במינהל התכנון`;
      searchValue = planNumber;
      description = `יש לפתוח את האתר הרשמי של מינהל התכנון (מידע תכנוני) ולחפש תוכנית ${planNumber}. יש לוודא שמספר התוכנית תואם לפרויקט ולבדוק את המסמכים המקוריים של התוכנית. התוצאה אינה מאומתת אוטומטית.`;
    } else if (block && uniqueParcels.length > 0) {
      const parcelsList = uniqueParcels.join(", ");
      title = `חיפוש גוש ${block} חלקה ${parcelsList} במינהל התכנון`;
      searchValue = `גוש ${block} חלקה ${parcelsList}`;
      description = `יש לפתוח את האתר הרשמי של מינהל התכנון (מידע תכנוני) ולחפש גוש ${block} חלקה ${parcelsList}. זיהוי גוש או חלקה תואמים אינו מספיק כדי לקשר באופן ודאי תוכנית או היתר לפרויקט, ויש לבדוק את המסמכים המקוריים ולוודא שהתוכנית רלוונטית לפרויקט המדויק.`;
    } else if (permitRequestNumber) {
      title = `חיפוש בקשה להיתר ${permitRequestNumber} במינהל התכנון`;
      searchValue = permitRequestNumber;
      description = `יש לפתוח את האתר הרשמי של מינהל התכנון (מידע תכנוני) ולבדוק אם ניתן לחפש לפי מספר בקשה להיתר ${permitRequestNumber}. לא כל שירותי החיפוש תומכים בחיפוש לפי מספר בקשה. יש לוודא שהבקשה רלוונטית לפרויקט.`;
    } else if (city) {
      title = `חיפוש רחב במינהל התכנון`;
      searchValue = city;
      description = `חסרים מזהים מדויקים (מספר תוכנית, גוש/חלקה או מספר בקשה להיתר). יש לפתוח את האתר הרשמי של מינהל התכנון (מידע תכנוני) ולבצע חיפוש רחב לפי העיר ${city}. חיפוש רחב עלול להחזיר תוכניות ומסמכים רבים שאינם קשורים לפרויקט, ויש לבדוק בקפידה.`;
    } else {
      title = "חיפוש במינהל התכנון";
      description = "חסרים מזהים למיקוד החיפוש. יש להוסיף לפרויקט מספר תוכנית, גוש/חלקה, או מספר בקשה להיתר כדי לבצע חיפוש ממוקד יותר במינהל התכנון.";
    }

    throw new ManualActionRequiredError({
      title,
      description,
      url: "https://www.gov.il/he/departments/iplan/govil-landing-page",
      searchValue,
    });
  }
}
