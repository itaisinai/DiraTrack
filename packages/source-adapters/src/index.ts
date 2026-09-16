import { type Fetcher, ManualActionRequiredError, type ResearchIdentifier, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";
import { IsraelLandAuthorityAdapter } from "./israel-land-authority.ts";
import { PlanningAdministrationAdapter } from "./planning-administration.ts";
import { YehudLocalPlanningAdapter } from "./yehud-local-planning.ts";
import { YehudMonossonAdapter } from "./yehud-monosson.ts";
import { createDefaultCapability, DEFAULT_RETRY_POLICY, type RetryPolicy, type SourceCapability, type SourceImplementationMode } from "./source-health.ts";
import { withRetry } from "./retry.ts";

export * from "./types.ts";
export * from "./source-health.ts";
export * from "./health-check.ts";
export * from "./retry.ts";
export { IsraelLandAuthorityAdapter } from "./israel-land-authority.ts";
export { PlanningAdministrationAdapter } from "./planning-administration.ts";
export { YehudLocalPlanningAdapter } from "./yehud-local-planning.ts";
export { YehudMonossonAdapter } from "./yehud-monosson.ts";

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

export class AsiaCyrusAdapter implements SourceAdapter {
  readonly id = "asia-cyrus";
  private readonly fetcher: Fetcher;
  private readonly retryPolicy: RetryPolicy;

  constructor(fetcher: Fetcher = fetch, retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.fetcher = fetcher;
    this.retryPolicy = retryPolicy;
  }

  async discover(context: SourceResearchContext) {
    const terms = buildSearchTerms(context);
    const discoveries = new Map<string, SourceDiscoveryResult>();

    for (const term of terms) {
      const endpoint = new URL("https://asia-cyrus.co.il/wp-json/wp/v2/search");
      endpoint.searchParams.set("search", term.value);
      endpoint.searchParams.set("per_page", "20");

      // Use withRetry with fresh timeout per attempt
      let response: Response;
      try {
        response = await withRetry(async () => {
          const resp = await this.fetcher(endpoint, {
            headers: { Accept: "application/json", "User-Agent": "DiraTrack/0.1 research-worker" },
            signal: AbortSignal.timeout(20_000), // Fresh signal per retry
          });
          if (!resp.ok) throw resp;
          return resp;
        }, this.retryPolicy);
      } catch (error) {
        // Convert Response errors to Error with descriptive message
        if (error instanceof Response) {
          throw new Error(`Asia Cyrus search failed with HTTP ${error.status}`);
        }
        throw error;
      }

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
  if (sourceKey === "yehud-local-planning") return new YehudLocalPlanningAdapter();
  if (sourceKey === "yehud-monosson") return new YehudMonossonAdapter(fetcher);
  return null;
}

export function sourceRequiresManualAction(sourceKey: string) {
  return sourceKey === "discounted-housing" || sourceKey === "israel-land-authority" || sourceKey === "planning-administration" || sourceKey === "yehud-local-planning";
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

/**
 * Builds source capability metadata for all registered sources
 */
export function getSourceCapabilities(): SourceCapability[] {
  return mvpSourceCatalog.map((source) => {
    const mode: SourceImplementationMode =
      source.key === "user-uploads" ? "user-upload" :
      sourceRequiresManualAction(source.key) ? "manual" :
      "automatic";

    return createDefaultCapability(
      source.key,
      source.name,
      source.category,
      mode,
      source.baseUrl,
    );
  });
}

/**
 * Gets capability metadata for a specific source
 */
export function getSourceCapability(sourceKey: string): SourceCapability | null {
  const capabilities = getSourceCapabilities();
  return capabilities.find((cap) => cap.key === sourceKey) ?? null;
}
