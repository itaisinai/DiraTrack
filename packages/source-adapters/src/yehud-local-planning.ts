import { ManualActionRequiredError, type ResearchIdentifier, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";

const OFFICIAL_URL = "https://yehud.bartech-net.co.il/";

export class YehudLocalPlanningAdapter implements SourceAdapter {
  readonly id = "yehud-local-planning";

  async discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]> {
    const action = buildLocalPlanningAction(context);
    throw new ManualActionRequiredError(action);
  }
}

function buildLocalPlanningAction(context: SourceResearchContext) {
  const planNumber = firstIdentifier(context.identifiers, "plan-number");
  if (planNumber) {
    return {
      title: `חיפוש תוכנית ${planNumber} באתר הוועדה המקומית`,
      description: `יש לפתוח את אתר הוועדה המקומית יהוד־מונוסון ולחפש את תוכנית ${planNumber}. יש לבדוק את מסמכי התוכנית במקור ולאמת את הקשר לפרויקט לפני יצירת ממצא.`,
      url: OFFICIAL_URL,
      searchValue: planNumber,
    };
  }

  const permitRequest = firstIdentifier(context.identifiers, "permit-request-number");
  if (permitRequest) {
    return {
      title: `חיפוש בקשה ${permitRequest} באתר הוועדה המקומית`,
      description: `יש לפתוח את אתר הוועדה המקומית יהוד־מונוסון ולחפש את מספר הבקשה ${permitRequest}. עצם ההתאמה למספר אינה מאמתת היתר או שלב בנייה; יש לבדוק את הרשומה המקורית.`,
      url: OFFICIAL_URL,
      searchValue: permitRequest,
    };
  }

  const block = firstIdentifier(context.identifiers, "block");
  const parcels = allIdentifiers(context.identifiers, "parcel");
  if (block) {
    const searchValue = parcels.length > 0 ? `גוש ${block}, חלקות ${parcels.join(", ")}` : `גוש ${block}`;
    return {
      title: `איתור מידע תכנוני עבור גוש ${block}`,
      description: `יש לפתוח את אתר הוועדה המקומית יהוד־מונוסון ולחפש לפי ${searchValue}. התאמת גוש או חלקה בלבד אינה מוכיחה שהמידע שייך לפרויקט; יש לאמת גם את יתר המזהים במקור.`,
      url: OFFICIAL_URL,
      searchValue,
    };
  }

  const lot = firstIdentifier(context.identifiers, "lot");
  if (lot) {
    const city = context.project.city.trim();
    const searchValue = city ? `מגרש ${lot}, ${city}` : `מגרש ${lot}`;
    return {
      title: `חיפוש מגרש ${lot} באתר הוועדה המקומית`,
      description: `יש לפתוח את אתר הוועדה המקומית יהוד־מונוסון ולחפש את ${searchValue}. מספר מגרש ללא גוש וחלקה עלול להיות לא ייחודי ולכן נדרשת בדיקה ידנית של המקור.`,
      url: OFFICIAL_URL,
      searchValue,
    };
  }

  const city = context.project.city.trim();
  return {
    title: "חיפוש ידני באתר הוועדה המקומית",
    description: city
      ? `לא הוזנו מספר תוכנית, מספר בקשה, גוש או מגרש. ניתן לפתוח את אתר הוועדה המקומית ולבצע חיפוש רחב עבור ${city}, אך אין לסמן תוצאה כרלוונטית ללא התאמת מזהים.`
      : "לא הוזנו מזהים שמאפשרים חיפוש ממוקד. יש להוסיף מספר תוכנית, מספר בקשה, גוש וחלקה או מגרש לפני בדיקת המקור.",
    url: OFFICIAL_URL,
    searchValue: city || undefined,
  };
}

function firstIdentifier(identifiers: ResearchIdentifier[], type: string) {
  return identifiers.find((identifier) => identifier.type === type)?.value.trim() || undefined;
}

function allIdentifiers(identifiers: ResearchIdentifier[], type: string) {
  return [...new Set(identifiers.filter((identifier) => identifier.type === type).map((identifier) => identifier.value.trim()).filter(Boolean))];
}
