export interface WinningMessageField {
  value: string;
  evidence: string;
}

export interface ParsedWinningMessage {
  lotteryNumber?: WinningMessageField;
  housingProjectNumber?: WinningMessageField;
  city?: WinningMessageField;
  developer?: WinningMessageField;
  selectionPosition?: WinningMessageField;
  offeredApartments?: WinningMessageField;
  sourceUrl?: WinningMessageField;
  containsRegistrantNumber: boolean;
}

export function parseWinningMessage(message: string): ParsedWinningMessage {
  const normalized = normalizeMessage(message);
  return {
    lotteryNumber: extractField(normalized, /(?:הגרלה|מספר\s+הגרלה)\s*(?:מספר\s*)?(\d{3,})/u),
    housingProjectNumber: extractField(normalized, /לפרויקט\s+(\d+)/u),
    developer: extractField(normalized, /(?:של\s+קבלן|של\s+יזם)\s+(.+?)(?=\s+ביישוב|\n|$)/u),
    city: extractField(normalized, /ביישוב\s+([^\n.]+)/u),
    selectionPosition: extractField(normalized, /מקומך\s+לבחירת\s+דירה\s+(?:הוא|הינו)\s+(\d+)/u),
    offeredApartments: extractField(normalized, /הוצעו\s+(\d+)\s+דירות/u),
    sourceUrl: extractUrl(normalized),
    containsRegistrantNumber: /מספר\s+נרשם\s*:\s*\d+/u.test(normalized),
  };
}

function normalizeMessage(message: string) {
  return message
    .normalize("NFKC")
    .replaceAll("\u00a0", " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function extractField(message: string, pattern: RegExp): WinningMessageField | undefined {
  const match = pattern.exec(message);
  const value = match?.[1]?.trim();
  if (!match?.[0] || !value) return undefined;
  return { value, evidence: match[0].trim() };
}

function extractUrl(message: string): WinningMessageField | undefined {
  const markdownLink = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/u.exec(message);
  const plainUrl = /(https?:\/\/[^\s)\]]+)/u.exec(message);
  const match = markdownLink ?? plainUrl;
  const value = match?.[1]?.trim();
  if (!value) return undefined;
  return { value, evidence: match?.[0] ?? value };
}
