const MAX_SLUG_LENGTH = 80;

export function toProjectSlug(value: string) {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("he")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/g, "");

  if (!slug) throw new Error("Project slug must contain at least one letter or number");
  return slug;
}
