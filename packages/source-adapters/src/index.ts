export interface SourceDiscoveryResult { externalId: string; title: string; sourceUrl: string; metadata: Record<string, unknown>; }
export interface SourceAdapter { readonly id: string; validateIdentifiers(identifiers: Record<string, unknown>): Promise<void>; discover(identifiers: Record<string, unknown>): Promise<SourceDiscoveryResult[]>; }
