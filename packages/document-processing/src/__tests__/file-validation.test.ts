import { describe, it, expect } from "vitest";
import {
  detectMIMEFromContent,
  validateFileContent,
  sanitizeFilename,
  validateFile,
} from "../file-validation.js";

describe("File Validation", () => {
  describe("detectMIMEFromContent", () => {
    it("should detect PDF from magic bytes", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const result = detectMIMEFromContent(pdfBuffer);
      expect(result).toBe("application/pdf");
    });

    it("should detect JPEG from magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const result = detectMIMEFromContent(jpegBuffer);
      expect(result).toBe("image/jpeg");
    });

    it("should detect PNG from magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = detectMIMEFromContent(pngBuffer);
      expect(result).toBe("image/png");
    });

    it("should detect plain text", () => {
      const textBuffer = Buffer.from("Hello, world!");
      const result = detectMIMEFromContent(textBuffer);
      expect(result).toBe("text/plain");
    });

    it("should detect Hebrew text as plain text", () => {
      const hebrewBuffer = Buffer.from("שלום עולם");
      const result = detectMIMEFromContent(hebrewBuffer);
      expect(result).toBe("text/plain");
    });

    it("should return null for unknown binary content", () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = detectMIMEFromContent(unknownBuffer);
      expect(result).toBeNull();
    });
  });

  describe("validateFileContent", () => {
    it("should validate PDF with correct magic bytes", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, ...Array(100).fill(0)]);
      const result = validateFileContent("application/pdf", pdfBuffer);
      expect(result.valid).toBe(true);
    });

    it("should reject PDF with incorrect magic bytes", () => {
      const fakePdfBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
      const result = validateFileContent("application/pdf", fakePdfBuffer);
      expect(result.valid).toBe(false);
    });

    it("should reject file that is too small", () => {
      const tinyBuffer = Buffer.from([0x25, 0x50]);
      const result = validateFileContent("application/pdf", tinyBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("קטן");
    });

    it("should validate plain text without magic bytes", () => {
      const textBuffer = Buffer.from("This is plain text content.");
      const result = validateFileContent("text/plain", textBuffer);
      expect(result.valid).toBe(true);
    });

    it("should reject unsupported MIME type", () => {
      const buffer = Buffer.from("test");
      const result = validateFileContent("application/x-executable", buffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("לא נתמך");
    });
  });

  describe("sanitizeFilename", () => {
    it("should keep valid filename", () => {
      const result = sanitizeFilename("document.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("document.pdf");
    });

    it("should keep Hebrew characters", () => {
      const result = sanitizeFilename("מסמך-חשוב.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("מסמך-חשוב.pdf");
    });

    it("should replace path separators", () => {
      const result = sanitizeFilename("path/to/file.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("path_to_file.pdf");
    });

    it("should replace backslashes", () => {
      const result = sanitizeFilename("path\\to\\file.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("path_to_file.pdf");
    });

    it("should replace double dots", () => {
      const result = sanitizeFilename("../../../etc/passwd");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).not.toContain("..");
    });

    it("should remove control characters", () => {
      const result = sanitizeFilename("file\x00name.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).not.toContain("\x00");
    });

    it("should trim whitespace", () => {
      const result = sanitizeFilename("  document.pdf  ");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("document.pdf");
    });

    it("should limit length while preserving extension", () => {
      const longName = "a".repeat(250) + ".pdf";
      const result = sanitizeFilename(longName);
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toMatch(/\.pdf$/);
      expect(result.sanitizedFilename!.length).toBeLessThanOrEqual(204); // 200 + ".pdf"
    });

    it("should reject empty filename", () => {
      const result = sanitizeFilename("");
      expect(result.valid).toBe(false);
    });

    it("should reject dot-only filename", () => {
      const result = sanitizeFilename(".");
      expect(result.valid).toBe(false);
    });

    it("should reject double-dot filename", () => {
      const result = sanitizeFilename("..");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateFile", () => {
    it("should validate complete PDF file", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Array(100).fill(0)]);
      const result = validateFile("application/pdf", pdfBuffer, "document.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("document.pdf");
    });

    it("should reject invalid MIME type", () => {
      const buffer = Buffer.from("test");
      const result = validateFile("application/x-evil", buffer, "evil.exe");
      expect(result.valid).toBe(false);
    });

    it("should handle Hebrew filename", () => {
      const textBuffer = Buffer.from("תוכן");
      const result = validateFile("text/plain", textBuffer, "קובץ-בעברית.txt");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe("קובץ-בעברית.txt");
    });

    it("should validate and sanitize combined", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Array(100).fill(0)]);
      const result = validateFile("application/pdf", pdfBuffer, "../../../evil.pdf");
      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).not.toContain("..");
    });
  });
});
