export interface ResearchIdentifier { type: string; value: string; }
export interface SourceResearchContext { project: { name: string; city: string; developer: string | null }; identifiers: ResearchIdentifier[]; }
export interface SourceDiscoveryResult { externalId: string; title: string; sourceUrl: string; summary: string; matchingIdentifiers: ResearchIdentifier[]; metadata: Record<string, unknown>; }
export interface SourceAdapter { readonly id: string; discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]>; }

export interface ManualResearchAction { title: string; description: string; url: string; searchValue?: string; }

export class ManualActionRequiredError extends Error {
  readonly action: ManualResearchAction;
  constructor(action: ManualResearchAction) { super(action.description); this.name = "ManualActionRequiredError"; this.action = action; }
}

export const mvpSourceCatalog = [
  { key: "discounted-housing", name: "דירה בהנחה", category: "official", baseUrl: "https://www.dira.moch.gov.il", adapterKey: "discounted-housing" },
  { key: "israel-land-authority", name: "רשות מקרקעי ישראל", category: "official", baseUrl: "https://www.gov.il/he/departments/israel_land_authority", adapterKey: "israel-land-authority" },
  { key: "planning-administration", name: "מינהל התכנון", category: "official", baseUrl: "https://www.gov.il/he/departments/iplan", adapterKey: "planning-administration" },
  { key: "yehud-local-planning", name: "הוועדה המקומית יהוד־מונוסון", category: "municipal", baseUrl: "https://yehud.bartech-net.co.il", adapterKey: "yehud-local-planning" },
  { key: "yehud-monosson", name: "אתר עיריית יהוד־מונוסון", category: "municipal", baseUrl: "https://www.yehud-monosson.muni.il", adapterKey: "yehud-monosson" },
  { key: "asia-cyrus", name: "אתר אסיה סיירוס", category: "developer", baseUrl: "https://www.asia-cyrus.co.il", adapterKey: "asia-cyrus" },
  { key: "user-uploads", name: "מסמכים שהמשתמש העלה", category: "user-upload", baseUrl: null, adapterKey: "user-uploads" },
] as const;

export type MvpSourceDefinition = (typeof mvpSourceCatalog)[number];

interface WordPressSearchResult { id: number; title: string; url: string; type: string; subtype: string; }
type Fetcher = typeof fetch;

export class AsiaCyrusAdapter implements SourceAdapter {
  readonly id = "asia-cyrus";
  private readonly fetcher: Fetcher;

  constructor(fetcher: Fetcher = fetch) { this.fetcher = fetcher; }

  async discover(context: SourceResearchContext) {
    const terms = buildSearchTerms(context);
    const discoveries = new Map<string, SourceDiscoveryResult>();

    for (const term of terms) {
      const endpoint = new URL("https://asia-cyrus.co.il/wp-json/wp/v2/search");
      endpoint.searchParams.set("search", term.value);
      endpoint.searchParams.set("per_page", "20");
      const response = await this.fetcher(endpoint, { headers: { Accept: "application/json", "User-Agent": "DiraTrack/0.1 research-worker" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`Asia Cyrus search failed with HTTP ${response.status}`);
      const results = await response.json() as WordPressSearchResult[];

      for (const result of results) {
        if (!isWordPressSearchResult(result) || !["page", "post", "our-work"].includes(result.subtype)) continue;
        const key = String(result.id);
        const existing = discoveries.get(key);
        const matchingIdentifiers = term.identifier ? [...(existing?.matchingIdentifiers ?? []), term.identifier] : (existing?.matchingIdentifiers ?? []);
        discoveries.set(key, {
          externalId: key,
          title: decodeBasicHtmlEntities(result.title),
          sourceUrl: result.url,
          summary: `אתר היזם החזיר את העמוד בחיפוש עבור „${term.label}”. יש לפתוח את המקור ולאמת את הקשר לפרויקט.`,
          matchingIdentifiers: uniqueIdentifiers(matchingIdentifiers),
          metadata: { provider: "wordpress-rest-api", matchedTerms: [...new Set([...(existing?.metadata.matchedTerms as string[] | undefined ?? []), term.label])], type: result.type, subtype: result.subtype },
        });
      }
    }

    return [...discoveries.values()];
  }
}

export class DiscountedHousingAdapter implements SourceAdapter {
  readonly id = "discounted-housing";

  async discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]> {
    const lotteryNumber = context.identifiers.find((identifier) => identifier.type === "lottery-number")?.value.trim();
    const description = lotteryNumber
      ? `יש לפתוח את רשימת ההגרלות הרשמית ולחפש את הגרלה ${lotteryNumber}. האתר דורש בדיקה אינטראקטיבית ולכן DiraTrack אינו מסמן תוצאה כאוטומטית.`
      : "יש לפתוח את רשימת ההגרלות הרשמית. חסר מספר הגרלה שמאפשר למקד את החיפוש.";
    throw new ManualActionRequiredError({ title: lotteryNumber ? `חיפוש הגרלה ${lotteryNumber} באתר הרשמי` : "חיפוש באתר דירה בהנחה", description, url: "https://www.dira.moch.gov.il/ProjectsList", searchValue: lotteryNumber });
  }
}

export class YehudMonossonAdapter implements SourceAdapter {
  readonly id = "yehud-monosson";
  private readonly fetcher: Fetcher;

  constructor(fetcher: Fetcher = fetch) { this.fetcher = fetcher; }

  async discover(context: SourceResearchContext) {
    const terms = buildMunicipalSearchTerms(context);
    const discoveries = new Map<string, SourceDiscoveryResult>();

    for (const term of terms) {
      const endpoint = new URL("https://yehud-monosson.muni.il/wp-json/wp/v2/search");
      endpoint.searchParams.set("search", term.value);
      endpoint.searchParams.set("per_page", "20");
      endpoint.searchParams.set("type", "post");
      endpoint.searchParams.set("_fields", "id,title,url,type,subtype");
      const response = await this.fetcher(endpoint, {
        headers: { Accept: "application/json", "User-Agent": "DiraTrack/0.1 research-worker" },
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 403 || response.status === 429) {
        throw new ManualActionRequiredError({
          title: "נדרשת בדיקה ידנית באתר עיריית יהוד־מונוסון",
          description: `האתר העירוני חסם זמנית את החיפוש האוטומטי. יש לפתוח את האתר הרשמי ולחפש את „${term.value}”.`,
          url: "https://yehud-monosson.muni.il/",
          searchValue: term.value,
        });
      }
      if (!response.ok) throw new Error(`Yehud-Monosson search failed with HTTP ${response.status}`);

      const results = await response.json() as unknown;
      if (!Array.isArray(results)) throw new Error("Yehud-Monosson search returned an invalid response");

      for (const result of results) {
        if (!isWordPressSearchResult(result) || result.type !== "post" || !isOfficialMunicipalUrl(result.url)) continue;
        const key = String(result.id);
        const existing = discoveries.get(key);
        const matchingIdentifiers = term.identifier ? [...(existing?.matchingIdentifiers ?? []), term.identifier] : (existing?.matchingIdentifiers ?? []);
        discoveries.set(key, {
          externalId: key,
          title: decodeBasicHtmlEntities(result.title),
          sourceUrl: result.url,
          summary: `החיפוש באתר עיריית יהוד־מונוסון החזיר את העמוד עבור „${term.label}”. יש לפתוח את המקור ולאמת את הקשר לפרויקט.`,
          matchingIdentifiers: uniqueIdentifiers(matchingIdentifiers),
          metadata: {
            provider: "wordpress-rest-api",
            matchedTerms: [...new Set([...(existing?.metadata.matchedTerms as string[] | undefined ?? []), term.label])],
            type: result.type,
            subtype: result.subtype,
          },
        });
      }
    }

    return [...discoveries.values()];
  }
}

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

/**
 * Create mock fetcher for E2E tests
 * Returns deterministic responses without making external requests
 */
function createMockFetcher(): Fetcher {
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Mock Asia Cyrus WordPress API
    if (url.includes("asia-cyrus.co.il/wp-json/wp/v2/search")) {
      const urlObj = new URL(url);
      const searchTerm = urlObj.searchParams.get("search") || "";

      // Return one mock result
      const mockResults = [
        {
          id: 99999,
          title: `פרויקט מדגם - ${searchTerm}`,
          url: "https://asia-cyrus.co.il/projects/mock-project",
          type: "post",
          subtype: "our-work",
        },
      ];

      return new Response(JSON.stringify(mockResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;
    }

    if (url.includes("yehud-monosson.muni.il/wp-json/wp/v2/search")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;
    }

    // Block any other external requests in test mode
    throw new Error(
      `MOCK ERROR: Attempted unmocked external request to ${url}. ` +
      `Add mock handling or set LIVE_API_TESTS=1 for real requests.`
    );
  };
}

export function getSourceAdapter(sourceKey: string): SourceAdapter | null {
  // In E2E test mode, inject mock fetcher to prevent external requests
  const isTestMode = process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL.includes("test") && !process.env.LIVE_API_TESTS;
  const fetcher = isTestMode ? createMockFetcher() : fetch;

  if (sourceKey === "asia-cyrus") return new AsiaCyrusAdapter(fetcher);
  if (sourceKey === "discounted-housing") return new DiscountedHousingAdapter();
  if (sourceKey === "israel-land-authority") return new IsraelLandAuthorityAdapter();
  if (sourceKey === "planning-administration") return new PlanningAdministrationAdapter();
  if (sourceKey === "yehud-monosson") return new YehudMonossonAdapter(fetcher);
  return null;
}

export function sourceRequiresManualAction(sourceKey: string) {
  return sourceKey === "discounted-housing" || sourceKey === "israel-land-authority" || sourceKey === "planning-administration";
}

export function sourceSendsExternalData(sourceKey: string) {
  return sourceKey === "asia-cyrus" || sourceKey === "yehud-monosson";
}

function buildSearchTerms(context: SourceResearchContext) {
  const terms: Array<{ value: string; label: string; identifier?: ResearchIdentifier }> = [];
  if (context.project.name.trim()) terms.push({ value: context.project.name.trim(), label: `שם הפרויקט: ${context.project.name.trim()}` });
  if (context.project.city.trim()) terms.push({ value: context.project.city.trim(), label: `עיר: ${context.project.city.trim()}` });
  for (const identifier of context.identifiers) {
    const value = identifier.value.trim();
    if (value) terms.push({ value, label: `${identifierTypeLabel(identifier.type)} ${value}`, identifier: { type: identifier.type, value } });
  }
  return terms.filter((term, index, all) => all.findIndex((candidate) => candidate.value === term.value) === index);
}

function buildMunicipalSearchTerms(context: SourceResearchContext) {
  const terms: Array<{ value: string; label: string; identifier?: ResearchIdentifier }> = [];
  const projectName = context.project.name.trim();
  const developer = context.project.developer?.trim();
  if (projectName && !/^פרויקט(?:\s+\d+)?$/u.test(projectName)) terms.push({ value: projectName, label: `שם הפרויקט: ${projectName}` });
  if (developer) terms.push({ value: developer, label: `יזם: ${developer}` });

  const allowedIdentifiers = new Set(["block", "parcel", "lot", "plan-number", "tender-number", "permit-request-number", "lottery-number"]);
  for (const identifier of context.identifiers) {
    const value = identifier.value.trim();
    if (!value || !allowedIdentifiers.has(identifier.type)) continue;
    const normalized = { type: identifier.type, value };
    const searchValue = `${identifierTypeLabel(identifier.type)} ${value}`;
    terms.push({ value: searchValue, label: searchValue, identifier: normalized });
  }

  return terms.filter((term, index, all) => all.findIndex((candidate) => candidate.value === term.value) === index).slice(0, 10);
}

function isOfficialMunicipalUrl(value: string) {
  try {
    return new URL(value).origin === "https://yehud-monosson.muni.il";
  } catch {
    return false;
  }
}

function isWordPressSearchResult(value: unknown): value is WordPressSearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return typeof result.id === "number" && typeof result.title === "string" && typeof result.url === "string" && typeof result.type === "string" && typeof result.subtype === "string";
}

function uniqueIdentifiers(identifiers: ResearchIdentifier[]) {
  return identifiers.filter((identifier, index, all) => all.findIndex((candidate) => candidate.type === identifier.type && candidate.value === identifier.value) === index);
}

function identifierTypeLabel(type: string) {
  return ({ "lottery-number": "הגרלה", "housing-project-number": "פרויקט דיור", block: "גוש", parcel: "חלקה", lot: "מגרש", "plan-number": "תוכנית", "tender-number": "מכרז", "permit-request-number": "בקשה להיתר" } as Record<string, string>)[type] ?? type;
}

function decodeBasicHtmlEntities(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#8211;", "–").replaceAll("&#8212;", "—").replaceAll("&#39;", "'").replaceAll("&quot;", "\"");
}
