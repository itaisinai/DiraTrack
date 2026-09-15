import { ManualActionRequiredError, type Fetcher, type ResearchIdentifier, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";

const SEARCH_ENDPOINT = "https://yehud-monosson.muni.il/wp-json/wp/v2/search";
const MANUAL_URL = "https://www.yehud-monosson.muni.il/";
const OFFICIAL_HOSTS = new Set(["yehud-monosson.muni.il", "www.yehud-monosson.muni.il"]);
const MAX_SEARCH_TERMS = 10;

interface WordPressSearchResult { id: number; title: string; url: string; type: string; subtype: string; }

export class YehudMonossonAdapter implements SourceAdapter {
  readonly id = "yehud-monosson";
  private readonly fetcher: Fetcher;

  constructor(fetcher: Fetcher = fetch) { this.fetcher = fetcher; }

  async discover(context: SourceResearchContext) {
    const terms = buildMunicipalSearchTerms(context);
    const discoveries = new Map<string, SourceDiscoveryResult>();

    for (const term of terms) {
      const endpoint = new URL(SEARCH_ENDPOINT);
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
          url: MANUAL_URL,
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

  return terms.filter((term, index, all) => all.findIndex((candidate) => candidate.value === term.value) === index).slice(0, MAX_SEARCH_TERMS);
}

function isOfficialMunicipalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.port === "" && OFFICIAL_HOSTS.has(url.hostname);
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
  return ({ "lottery-number": "הגרלה", block: "גוש", parcel: "חלקה", lot: "מגרש", "plan-number": "תוכנית", "tender-number": "מכרז", "permit-request-number": "בקשה להיתר" } as Record<string, string>)[type] ?? type;
}

function decodeBasicHtmlEntities(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#8211;", "–").replaceAll("&#8212;", "—").replaceAll("&#39;", "'").replaceAll("&quot;", "\"");
}
