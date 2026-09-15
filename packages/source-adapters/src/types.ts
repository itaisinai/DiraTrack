export interface ResearchIdentifier { type: string; value: string; }
export interface SourceResearchContext { project: { name: string; city: string; developer: string | null }; identifiers: ResearchIdentifier[]; }
export interface SourceDiscoveryResult { externalId: string; title: string; sourceUrl: string; summary: string; matchingIdentifiers: ResearchIdentifier[]; metadata: Record<string, unknown>; }
export interface SourceAdapter { readonly id: string; discover(context: SourceResearchContext): Promise<SourceDiscoveryResult[]>; }

export interface ManualResearchAction { title: string; description: string; url: string; searchValue?: string; }

export class ManualActionRequiredError extends Error {
  readonly action: ManualResearchAction;

  constructor(action: ManualResearchAction) {
    super(action.description);
    this.name = "ManualActionRequiredError";
    this.action = action;
  }
}

export type Fetcher = typeof fetch;
