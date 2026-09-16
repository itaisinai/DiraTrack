import { ManualActionRequiredError, type Fetcher, type ResearchIdentifier, type SourceAdapter, type SourceDiscoveryResult, type SourceResearchContext } from "./types.ts";
import { DEFAULT_RETRY_POLICY, type RetryPolicy } from "./source-health.ts";
import { withRetry } from "./retry.ts";

const SEARCH_ENDPOINT = "https://yehud-monosson.muni.il/wp-json/wp/v2/search";
const MANUAL_URL = "https://www.yehud-monosson.muni.il/";
const OFFICIAL_HOSTS = new Set(["yehud-monosson.muni.il", "www.yehud-monosson.muni.il"]);
const MAX_SEARCH_TERMS = 10;

interface WordPressSearchResult { id: number; title: string; url: string; type: string; subtype: string; }

export class YehudMonossonAdapter implements SourceAdapter {
  readonly id = "yehud-monosson";
  private readonly fetcher: Fetcher;
  private readonly retryPolicy: RetryPolicy;

  constructor(fetcher: Fetcher = fetch, retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.fetcher = fetcher;
    this.retryPolicy = retryPolicy;
  }

  async discover(context: SourceResearchContext) {
    const terms = buildMunicipalSearchTerms(context);
    const discoveries = new Map<string, SourceDiscoveryResult>();

    for (const term of terms) {
      const endpoint = new URL(SEARCH_ENDPOINT);
      endpoint.searchParams.set('search', term.value);
      endpoint.searchParams.set('per_page', '20');
      endpoint.searchParams.set('type', 'post');
      endpoint.searchParams.set('_fields', 'id,title,url,type,subtype');

      // Wrap fetch with retry logic, but handle 403/429 specially
      let response: Response;
      try {
        response = await withRetry(async () => {
          const resp = await this.fetcher(endpoint, {
            headers: { Accept: 'application/json', 'User-Agent': 'DiraTrack/0.1 research-worker' },
            signal: AbortSignal.timeout(20_000),
          });

          // Check for 403/429 and convert to manual action (don't retry these)
          if (resp.status === 403 || resp.status === 429) {
            const manualTitle = 'נדרשת בדיקה ידנית באתר עיריית יהוד־מונוסון';
            const manualDesc = 'האתר העירוני חסם זמנית את החיפוש האוטומטי. יש לפתוח את האתר הרשמי ולחפש את "' + term.value + '".';
            throw new ManualActionRequiredError({
              title: manualTitle,
              description: manualDesc,
              url: MANUAL_URL,
              searchValue: term.value,
            });
          }

          if (!resp.ok) throw resp; // Will be caught and retried if appropriate
          return resp;
        }, this.retryPolicy);
      } catch (error) {
        // If it's a ManualActionRequiredError, rethrow it (don't retry)
        if (error instanceof ManualActionRequiredError) throw error;
        // For other errors, wrap with descriptive message
        if (error instanceof Response) {
          throw new Error('Yehud-Monosson search failed with HTTP ' + String(error.status));
        }
        throw error;
      }

      const results = await response.json() as unknown;
      if (!Array.isArray(results)) throw new Error('Yehud-Monosson search returned an invalid response');

      for (const result of results) {
        if (!isWordPressSearchResult(result) || result.type !== 'post' || !isOfficialMunicipalUrl(result.url)) continue;
        const key = String(result.id);
        const existing = discoveries.get(key);
        const matchingIdentifiers = term.identifier ? [...(existing?.matchingIdentifiers ?? []), term.identifier] : (existing?.matchingIdentifiers ?? []);
        const summary = 'החיפוש באתר עיריית יהוד־מונוסון החזיר את העמוד עבור "' + term.label + '". יש לפתוח את המקור ולאמת את הקשר לפרויקט.';
        discoveries.set(key, {
          externalId: key,
          title: decodeBasicHtmlEntities(result.title),
          sourceUrl: result.url,
          summary,
          matchingIdentifiers: uniqueIdentifiers(matchingIdentifiers),
          metadata: {
            provider: 'wordpress-rest-api',
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
  if (projectName && !/^פרויקט(?:\s+\d+)?$/u.test(projectName)) {
    const label = 'שם הפרויקט: ' + projectName;
    terms.push({ value: projectName, label });
  }
  if (developer) {
    const label = 'יזם: ' + developer;
    terms.push({ value: developer, label });
  }

  const allowedIdentifiers = new Set(['block', 'parcel', 'lot', 'plan-number', 'tender-number', 'permit-request-number', 'lottery-number']);
  for (const identifier of context.identifiers) {
    const value = identifier.value.trim();
    if (!value || !allowedIdentifiers.has(identifier.type)) continue;
    const normalized = { type: identifier.type, value };
    const searchValue = identifierTypeLabel(identifier.type) + ' ' + value;
    terms.push({ value: searchValue, label: searchValue, identifier: normalized });
  }

  return terms.filter((term, index, all) => all.findIndex((candidate) => candidate.value === term.value) === index).slice(0, MAX_SEARCH_TERMS);
}

function isOfficialMunicipalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.port === '' && OFFICIAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isWordPressSearchResult(value: unknown): value is WordPressSearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return typeof result.id === 'number' && typeof result.title === 'string' && typeof result.url === 'string' && typeof result.type === 'string' && typeof result.subtype === 'string';
}

function uniqueIdentifiers(identifiers: ResearchIdentifier[]) {
  return identifiers.filter((identifier, index, all) => all.findIndex((candidate) => candidate.type === identifier.type && candidate.value === identifier.value) === index);
}

function identifierTypeLabel(type: string) {
  const labels: Record<string, string> = {
    'lottery-number': 'הגרלה',
    block: 'גוש',
    parcel: 'חלקה',
    lot: 'מגרש',
    'plan-number': 'תוכנית',
    'tender-number': 'מכרז',
    'permit-request-number': 'בקשה להיתר',
  };
  return labels[type] ?? type;
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#8211;', '–')
    .replaceAll('&#8212;', '—')
    .replaceAll("&#39;", "'")
    .replaceAll('&quot;', '"');
}
