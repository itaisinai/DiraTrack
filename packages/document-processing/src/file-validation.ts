import path from "node:path";

/**
 * File validation: MIME types, magic bytes, filename sanitization
 *
 * Security requirements:
 * - Validate file content, not just HTTP headers
 * - Check file signatures (magic bytes) for binary formats
 * - Sanitize filenames to prevent path traversal
 * - Support Hebrew filenames safely
 * - Reject executable or ambiguous content
 */

export interface MIMETypeInfo {
  mimeType: string;
  extension: string;
  label: string;
  magicBytes?: Buffer[];
  minBytesRequired?: number;
}

/**
 * Allowed MIME types with their signatures and metadata
 */
export const ALLOWED_MIME_TYPES: Record<string, MIMETypeInfo> = {
  "application/pdf": {
    mimeType: "application/pdf",
    extension: ".pdf",
    label: "PDF",
    magicBytes: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
    minBytesRequired: 4,
  },
  "application/msword": {
    mimeType: "application/msword",
    extension: ".doc",
    label: "Word",
    magicBytes: [
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // OLE2
    ],
    minBytesRequired: 8,
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
    label: "Word (DOCX)",
    magicBytes: [
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP signature (DOCX is ZIP)
    ],
    minBytesRequired: 4,
  },
  "application/vnd.ms-excel": {
    mimeType: "application/vnd.ms-excel",
    extension: ".xls",
    label: "Excel",
    magicBytes: [
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // OLE2
    ],
    minBytesRequired: 8,
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx",
    label: "Excel (XLSX)",
    magicBytes: [
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP signature
    ],
    minBytesRequired: 4,
  },
  "image/jpeg": {
    mimeType: "image/jpeg",
    extension: ".jpg",
    label: "תמונה (JPEG)",
    magicBytes: [
      Buffer.from([0xff, 0xd8, 0xff]), // JPEG signature
    ],
    minBytesRequired: 3,
  },
  "image/png": {
    mimeType: "image/png",
    extension: ".png",
    label: "תמונה (PNG)",
    magicBytes: [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    ],
    minBytesRequired: 8,
  },
  "text/plain": {
    mimeType: "text/plain",
    extension: ".txt",
    label: "קובץ טקסט",
    // No magic bytes for plain text - validate by absence of control characters
  },
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMIME?: string;
  sanitizedFilename?: string;
}

/**
 * Check if buffer starts with magic bytes
 */
function matchesMagicBytes(buffer: Buffer, magicBytes: Buffer[]): boolean {
  return magicBytes.some((magic) => {
    if (buffer.length < magic.length) return false;
    return buffer.subarray(0, magic.length).equals(magic);
  });
}

/**
 * Detect MIME type from file content (magic bytes)
 */
export function detectMIMEFromContent(buffer: Buffer): string | null {
  if (buffer.length === 0) return null;

  // Check each allowed MIME type
  for (const info of Object.values(ALLOWED_MIME_TYPES)) {
    if (info.magicBytes && matchesMagicBytes(buffer, info.magicBytes)) {
      return info.mimeType;
    }
  }

  // For text/plain, check if it's valid UTF-8 without excessive control characters
  try {
    const text = buffer.toString("utf8");
    const controlChars = text.match(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/g);
    if (!controlChars || controlChars.length < text.length * 0.01) {
      return "text/plain";
    }
  } catch {
    // Not valid UTF-8
  }

  return null;
}

/**
 * Validate file content against declared MIME type
 */
export function validateFileContent(
  declaredMIME: string,
  buffer: Buffer
): FileValidationResult {
  const mimeInfo = ALLOWED_MIME_TYPES[declaredMIME];

  if (!mimeInfo) {
    return {
      valid: false,
      error: `סוג קובץ לא נתמך: ${declaredMIME}`,
    };
  }

  // Check minimum bytes
  if (mimeInfo.minBytesRequired && buffer.length < mimeInfo.minBytesRequired) {
    return {
      valid: false,
      error: "הקובץ קטן מדי או פגום",
    };
  }

  // Validate magic bytes if defined
  if (mimeInfo.magicBytes) {
    if (!matchesMagicBytes(buffer, mimeInfo.magicBytes)) {
      // Try to detect actual type
      const detectedMIME = detectMIMEFromContent(buffer);

      if (detectedMIME && detectedMIME !== declaredMIME) {
        return {
          valid: false,
          error: `סוג הקובץ המוצהר (${declaredMIME}) לא תואם לתוכן בפועל`,
          detectedMIME,
        };
      }

      return {
        valid: false,
        error: "תוכן הקובץ לא תואם לסוג המוצהר",
      };
    }
  }

  return { valid: true, detectedMIME: declaredMIME };
}

/**
 * Sanitize filename to prevent path traversal and malicious names
 *
 * Requirements:
 * - Remove or replace path separators
 * - Preserve Hebrew characters
 * - Limit length
 * - Remove control characters
 * - Keep extension for validation
 */
export function sanitizeFilename(filename: string): FileValidationResult {
  if (!filename || filename.length === 0) {
    return { valid: false, error: "שם קובץ ריק" };
  }

  // Remove path separators and null bytes
  let sanitized = filename
    .replace(/[/\\]/g, "_")
    .replace(/\0/g, "")
    .replace(/\.\./g, "__");

  // Remove control characters (except tab and newline which we'll also remove)
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length (keep extension)
  const ext = path.extname(sanitized);
  const base = path.basename(sanitized, ext);

  if (base.length === 0) {
    return { valid: false, error: "שם קובץ לא תקין" };
  }

  // Limit base to 200 characters (UTF-8 safe)
  const maxBaseLength = 200;
  const trimmedBase = base.length > maxBaseLength
    ? base.slice(0, maxBaseLength)
    : base;

  sanitized = trimmedBase + ext;

  // Final validation
  if (sanitized.length === 0 || sanitized === "." || sanitized === "..") {
    return { valid: false, error: "שם קובץ לא חוקי" };
  }

  return { valid: true, sanitizedFilename: sanitized };
}

/**
 * Get proper extension for detected MIME type
 */
export function getExtensionForMIME(mimeType: string): string {
  const info = ALLOWED_MIME_TYPES[mimeType];
  return info?.extension || ".bin";
}

/**
 * Get label for MIME type (Hebrew)
 */
export function getLabelForMIME(mimeType: string): string {
  const info = ALLOWED_MIME_TYPES[mimeType];
  return info?.label || mimeType;
}

/**
 * Validate complete file: MIME type, content, filename
 */
export function validateFile(
  declaredMIME: string,
  buffer: Buffer,
  proposedFilename: string
): FileValidationResult {
  // 1. Validate MIME is allowed
  if (!ALLOWED_MIME_TYPES[declaredMIME]) {
    return {
      valid: false,
      error: `סוג קובץ לא נתמך: ${declaredMIME}`,
    };
  }

  // 2. Validate content
  const contentResult = validateFileContent(declaredMIME, buffer);
  if (!contentResult.valid) {
    return contentResult;
  }

  // 3. Sanitize filename
  const filenameResult = sanitizeFilename(proposedFilename);
  if (!filenameResult.valid) {
    return filenameResult;
  }

  return {
    valid: true,
    detectedMIME: contentResult.detectedMIME,
    sanitizedFilename: filenameResult.sanitizedFilename,
  };
}
