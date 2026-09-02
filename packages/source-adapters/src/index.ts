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

export function getSourceAdapter(sourceKey: string): SourceAdapter | null {
  if (sourceKey === "asia-cyrus") return new AsiaCyrusAdapter();
  if (sourceKey === "discounted-housing") return new DiscountedHousingAdapter();
  return null;
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
