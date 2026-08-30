import type { CreateProjectInput, NewProjectIdentifier } from "@diratrack/database";

const identifierTypes = new Set([
  "lottery-number",
  "housing-project-number",
  "tender-number",
  "plan-number",
  "block",
  "parcel",
  "lot",
  "permit-request-number",
  "custom",
]);
const identifierOrigins = new Set(["winning-message", "manual", "official-source", "research"]);

export class InputError extends Error {}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new InputError(`${field} is required`);
  return value.trim();
}

function optionalString(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new InputError(`${field} must be a string`);
  return value.trim() || undefined;
}

function parseIdentifier(value: unknown): NewProjectIdentifier {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Each identifier must be an object");
  const candidate = value as Record<string, unknown>;
  const type = requiredString(candidate.type, "identifier.type");
  const origin = requiredString(candidate.origin, "identifier.origin");
  if (!identifierTypes.has(type)) throw new InputError("identifier.type is invalid");
  if (!identifierOrigins.has(origin)) throw new InputError("identifier.origin is invalid");

  return {
    type: type as NewProjectIdentifier["type"],
    value: requiredString(candidate.value, "identifier.value"),
    origin: origin as NewProjectIdentifier["origin"],
    sourceUrl: optionalString(candidate.sourceUrl, "identifier.sourceUrl"),
  };
}

export function parseCreateProjectInput(value: unknown): CreateProjectInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Request body must be an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.identifiers !== undefined && !Array.isArray(candidate.identifiers)) throw new InputError("identifiers must be an array");

  return {
    name: requiredString(candidate.name, "name"),
    city: requiredString(candidate.city, "city"),
    developer: optionalString(candidate.developer, "developer"),
    slug: optionalString(candidate.slug, "slug"),
    identifiers: (candidate.identifiers ?? []).map(parseIdentifier),
  };
}
