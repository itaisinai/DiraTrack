import { ManualActionRequiredError, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";

export class IsraelLandAuthorityAdapter implements SourceAdapter {
  readonly id = "israel-land-authority";

  async discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]> {
    const tenderNumber = context.identifiers.find((id) => id.type === "tender-number")?.value.trim();
    const lotNumber = context.identifiers.find((id) => id.type === "lot")?.value.trim();
    const block = context.identifiers.find((id) => id.type === "block")?.value.trim();
    const parcels = context.identifiers.filter((id) => id.type === "parcel").map((id) => id.value.trim()).filter((v) => v);
    const uniqueParcels = [...new Set(parcels)];
    const housingProjectNumber = context.identifiers.find((id) => id.type === "housing-project-number")?.value.trim();
    const projectName = context.project.name.trim();
    const city = context.project.city.trim();

    let title: string;
    let searchValue: string | undefined;
    let description: string;

    if (tenderNumber) {
      title = `חיפוש מכרז ${tenderNumber} ברשות מקרקעי ישראל`;
      searchValue = tenderNumber;
      description = `יש לפתוח את האתר הרשמי של רשות מקרקעי ישראל ולחפש מכרז ${tenderNumber}. יש לוודא שמספר המכרז תואם את המכרז של הפרויקט. התוצאה אינה מאומתת אוטומטית ודורשת בדיקה ידנית.`;
    } else if (lotNumber) {
      title = `חיפוש מגרש ${lotNumber} ברשות מקרקעי ישראל`;
      searchValue = lotNumber;
      description = `יש לפתוח את האתר הרשמי של רשות מקרקעי ישראל ולחפש מגרש ${lotNumber}. יש לוודא שמספר המגרש תואם את הפרויקט. התוצאה אינה מאומתת אוטומטית ודורשת בדיקה ידנית.`;
    } else if (block && uniqueParcels.length > 0) {
      const parcelsList = uniqueParcels.join(", ");
      title = `חיפוש גוש ${block} חלקה ${parcelsList} ברשות מקרקעי ישראל`;
      searchValue = `גוש ${block} חלקה ${parcelsList}`;
      description = `יש לפתוח את האתר הרשמי של רשות מקרקעי ישראל ולחפש גוש ${block} חלקה ${parcelsList}. חיפוש לפי גוש וחלקה אינו מספיק כדי לקשר באופן ודאי מגרש או מכרז לפרויקט, ויש לבדוק שהמסמכים המקוריים מתייחסים לפרויקט המדויק.`;
    } else if (housingProjectNumber) {
      title = `חיפוש פרויקט דיור ${housingProjectNumber} ברשות מקרקעי ישראל`;
      searchValue = housingProjectNumber;
      description = `יש לפתוח את האתר הרשמי של רשות מקרקעי ישראל ולחפש פרויקט דיור ${housingProjectNumber}. התוצאה אינה מאומתת אוטומטית ודורשת בדיקה ידנית.`;
    } else if (projectName && city) {
      title = `חיפוש רחב ברשות מקרקעי ישראל`;
      searchValue = `${projectName} ${city}`;
      description = `חסרים מזהים מדויקים (מספר מכרז, מגרש, גוש/חלקה או מספר פרויקט דיור). יש לפתוח את האתר הרשמי של רשות מקרקעי ישראל ולנסות חיפוש רחב לפי "${projectName}" בעיר ${city}. חיפוש רחב עלול להחזיר תוצאות לא רלוונטיות, ויש לבדוק בקפידה.`;
    } else {
      title = "חיפוש ברשות מקרקעי ישראל";
      description = "חסרים מזהים למיקוד החיפוש. יש להוסיף לפרויקט מספר מכרז, מגרש, גוש/חלקה, או מספר פרויקט דיור כדי לבצע חיפוש ממוקד יותר ברשות מקרקעי ישראל.";
    }

    throw new ManualActionRequiredError({
      title,
      description,
      url: "https://www.gov.il/he/departments/israel_land_authority/govil-landing-page",
      searchValue,
    });
  }
}
