export interface SourceDiscoveryResult { externalId: string; title: string; sourceUrl: string; metadata: Record<string, unknown>; }
export interface SourceAdapter { readonly id: string; validateIdentifiers(identifiers: Record<string, unknown>): Promise<void>; discover(identifiers: Record<string, unknown>): Promise<SourceDiscoveryResult[]>; }

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
