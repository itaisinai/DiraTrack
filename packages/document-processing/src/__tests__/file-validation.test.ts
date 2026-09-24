import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectMIMEFromContent,
  validateFileContent,
  sanitizeFilename,
  validateFile,
} from "../file-validation";

describe("File Validation", () => {
  describe("detectMIMEFromContent", () => {
    it("should detect PDF from magic bytes", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const result = detectMIMEFromContent(pdfBuffer);
      assert.equal(result, "application/pdf");
    });

    it("should detect JPEG from magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const result = detectMIMEFromContent(jpegBuffer);
      assert.equal(result, "image/jpeg");
    });

    it("should detect PNG from magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = detectMIMEFromContent(pngBuffer);
      assert.equal(result, "image/png");
    });

    it("should detect plain text", () => {
      const textBuffer = Buffer.from("Hello, world!");
      const result = detectMIMEFromContent(textBuffer);
      assert.equal(result, "text/plain");
    });

    it("should detect Hebrew text as plain text", () => {
      const hebrewBuffer = Buffer.from("שלום עולם");
      const result = detectMIMEFromContent(hebrewBuffer);
      assert.equal(result, "text/plain");
    });

    it("should return null for unknown binary content", () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = detectMIMEFromContent(unknownBuffer);
      assert.equal(result, null);
    });
  });

  describe("validateFileContent", () => {
    it("should validate PDF with correct magic bytes", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, ...Array(100).fill(0)]);
      const result = validateFileContent("application/pdf", pdfBuffer);
      assert.equal(result.valid, true);
    });

    it("should reject PDF with incorrect magic bytes", () => {
      const fakePdfBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
      const result = validateFileContent("application/pdf", fakePdfBuffer);
      assert.equal(result.valid, false);
    });

    it("should reject file that is too small", () => {
      const tinyBuffer = Buffer.from([0x25, 0x50]);
      const result = validateFileContent("application/pdf", tinyBuffer);
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("קטן"));
    });

    it("should validate plain text without magic bytes", () => {
      const textBuffer = Buffer.from("This is plain text content.");
      const result = validateFileContent("text/plain", textBuffer);
      assert.equal(result.valid, true);
    });

    it("should reject unsupported MIME type", () => {
      const buffer = Buffer.from("test");
      const result = validateFileContent("application/x-executable", buffer);
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes("לא נתמך"));
    });
  });

  describe("sanitizeFilename", () => {
    it("should keep valid filename", () => {
      const result = sanitizeFilename("document.pdf");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "document.pdf");
    });

    it("should keep Hebrew characters", () => {
      const result = sanitizeFilename("מסמך-חשוב.pdf");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "מסמך-חשוב.pdf");
    });

    it("should replace path separators", () => {
      const result = sanitizeFilename("path/to/file.pdf");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "path_to_file.pdf");
    });

    it("should replace backslashes", () => {
      const result = sanitizeFilename("path\\to\\file.pdf");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "path_to_file.pdf");
    });

    it("should replace double dots", () => {
      const result = sanitizeFilename("../../../etc/passwd");
      assert.equal(result.valid, true);
      assert.ok(!result.sanitizedFilename?.includes(".."));
    });

    it("should remove control characters", () => {
      const result = sanitizeFilename("file\x00name.pdf");
      assert.equal(result.valid, true);
      assert.ok(!result.sanitizedFilename?.includes("\x00"));
    });

    it("should trim whitespace", () => {
      const result = sanitizeFilename("  document.pdf  ");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "document.pdf");
    });

    it("should limit length while preserving extension", () => {
      const longName = "a".repeat(250) + ".pdf";
      const result = sanitizeFilename(longName);
      assert.equal(result.valid, true);
      assert.ok(result.sanitizedFilename?.endsWith(".pdf"));
      assert.ok((result.sanitizedFilename?.length || 0) <= 204); // 200 + ".pdf"
    });

    it("should reject empty filename", () => {
      const result = sanitizeFilename("");
      assert.equal(result.valid, false);
    });

    it("should reject dot-only filename", () => {
      const result = sanitizeFilename(".");
      assert.equal(result.valid, false);
    });

    it("should sanitize double-dot filename", () => {
      const result = sanitizeFilename("..");
      // After replacing ".." with "__", this becomes just "__" with no base
      // Actually sanitizeFilename("..") becomes "" after replacement and trim, which is invalid
      // Let me verify: ".." -> replace /\.\./g -> "__" -> remove controls -> "__" -> trim -> "__"
      // basename("__", "") -> "__", which is valid
      // So it should be valid but sanitized
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "__");
    });
  });

  describe("validateFile", () => {
    it("should validate complete PDF file", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Array(100).fill(0)]);
      const result = validateFile("application/pdf", pdfBuffer, "document.pdf");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "document.pdf");
    });

    it("should reject invalid MIME type", () => {
      const buffer = Buffer.from("test");
      const result = validateFile("application/x-evil", buffer, "evil.exe");
      assert.equal(result.valid, false);
    });

    it("should handle Hebrew filename", () => {
      const textBuffer = Buffer.from("תוכן");
      const result = validateFile("text/plain", textBuffer, "קובץ-בעברית.txt");
      assert.equal(result.valid, true);
      assert.equal(result.sanitizedFilename, "קובץ-בעברית.txt");
    });

    it("should validate and sanitize combined", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Array(100).fill(0)]);
      const result = validateFile("application/pdf", pdfBuffer, "../../../evil.pdf");
      assert.equal(result.valid, true);
      assert.ok(!result.sanitizedFilename?.includes(".."));
    });
  });
});
