import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateURLStructure } from "./url-security";
import { validateFileContent, sanitizeFilename } from "./file-validation";
import { safeFetch } from "./safe-http-client";

/**
 * Streaming file downloader with security controls
 *
 * Features:
 * - Streams to temporary file (no memory buffering)
 * - Calculates SHA-256 while streaming
 * - Enforces size limits during download
 * - Validates URL and redirects
 * - Atomic rename after validation
 * - Cleanup on all failure paths
 */

export interface DownloadOptions {
  url: string;
  maxSizeBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  userAgent?: string;
  expectedMIME?: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  tempPath?: string;
  sha256?: string;
  sizeBytes?: number;
  actualMIME?: string;
  finalURL?: string;
}

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT = 60000; // 60s
const DEFAULT_USER_AGENT = "DiraTrack/1.0 (+https://github.com/itaisinai/DiraTrack)";

/**
 * Download file with streaming and security validation
 */
export async function downloadFileSecurely(
  options: DownloadOptions
): Promise<DownloadResult> {
  const {
    url,
    maxSizeBytes = DEFAULT_MAX_SIZE,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT,
    userAgent = DEFAULT_USER_AGENT,
    expectedMIME,
  } = options;

  let tempPath: string | null = null;
  let writeStream: fs.FileHandle | null = null;
  let timeout: NodeJS.Timeout | null = null;

  try {
    // 1. Validate URL structure
    const urlValidation = validateURLStructure(url);
    if (!urlValidation.valid || !urlValidation.url) {
      return {
        success: false,
        error: urlValidation.error || "כתובת URL לא תקינה",
      };
    }

    // 2. Create temporary file
    const tmpDir = path.join(process.cwd(), "data", "tmp");
    await fs.mkdir(tmpDir, { recursive: true });

    const tmpFilename = `download-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.tmp`;
    tempPath = path.join(tmpDir, tmpFilename);

    // 3. Fetch with DNS pinning and redirect validation
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);

    const fetchResult = await safeFetch({
      url,
      method: "GET",
      headers: {
        "User-Agent": userAgent,
      },
      signal: controller.signal,
      maxRedirects,
    });

    if (!fetchResult.ok || !fetchResult.response) {
      if (timeout) clearTimeout(timeout);
      return {
        success: false,
        error: fetchResult.error || "שגיאה בהורדה",
      };
    }

    const response = fetchResult.response;
    const currentURL = fetchResult.finalURL || url;

    // 4. Validate content type
    const contentTypeHeader = response.headers["content-type"];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
    const mimeType = (contentType || "").split(";")[0]?.trim() || "application/octet-stream";

    if (expectedMIME && mimeType !== expectedMIME) {
      if (timeout) clearTimeout(timeout);
      return {
        success: false,
        error: `סוג הקובץ לא תואם: ציפינו ל־${expectedMIME}, קיבלנו ${mimeType}`,
      };
    }

    // 5. Check content length if provided
    const contentLengthHeader = response.headers["content-length"];
    const contentLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
    if (contentLength) {
      const declaredSize = Number.parseInt(contentLength, 10);
      if (declaredSize > maxSizeBytes) {
        if (timeout) clearTimeout(timeout);
        return {
          success: false,
          error: `הקובץ גדול מדי: ${(declaredSize / (1024 * 1024)).toFixed(1)} MB (מקסימום: ${(maxSizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
        };
      }
    }

    // 6. Stream to file and calculate hash
    // Undici body is a Node.js stream, not a web ReadableStream
    if (!response.body) {
      if (timeout) clearTimeout(timeout);
      return {
        success: false,
        error: "לא ניתן לקרוא את תוכן התגובה",
      };
    }

    writeStream = await fs.open(tempPath, "w");
    const hash = crypto.createHash("sha256");
    let totalBytes = 0;

    try {
      // Undici body is a Node.js Readable stream
      for await (const chunk of response.body) {
        totalBytes += chunk.length;

        // Enforce size limit while streaming
        if (totalBytes > maxSizeBytes) {
          throw new Error(
            `הקובץ גדול מדי: חרג מ־${(maxSizeBytes / (1024 * 1024)).toFixed(1)} MB במהלך ההורדה`
          );
        }

        // Write to file and update hash
        await writeStream.write(chunk);
        hash.update(chunk);
      }

      // Streaming completed successfully - clear the timeout
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      await writeStream.close();
      writeStream = null;

      const sha256 = hash.digest("hex");

      // 7. Validate file content (read first chunk for magic bytes)
      const validationBuffer = Buffer.alloc(Math.min(totalBytes, 8192));
      const validationHandle = await fs.open(tempPath, "r");
      await validationHandle.read(validationBuffer, 0, validationBuffer.length, 0);
      await validationHandle.close();

      const contentValidation = validateFileContent(mimeType, validationBuffer);
      if (!contentValidation.valid) {
        // Cleanup temp file
        await fs.unlink(tempPath);
        return {
          success: false,
          error: contentValidation.error || "תוכן הקובץ לא תקין",
        };
      }

      return {
        success: true,
        tempPath,
        sha256,
        sizeBytes: totalBytes,
        actualMIME: contentValidation.detectedMIME || mimeType,
        finalURL: currentURL,
      };
    } catch (streamError) {
      // Cleanup on stream error (including timeout during streaming)
      if (timeout) clearTimeout(timeout);
      if (writeStream) {
        await writeStream.close().catch(() => {});
      }
      if (tempPath) {
        await fs.unlink(tempPath).catch(() => {});
      }

      return {
        success: false,
        error: streamError instanceof Error
          ? streamError.message
          : "שגיאה בהורדת הקובץ",
      };
    }
  } catch (error) {
    // Cleanup on any error
    if (timeout) clearTimeout(timeout);
    if (writeStream) {
      await writeStream.close().catch(() => {});
    }
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בהורדת הקובץ",
    };
  }
}

/**
 * Move temp file to final destination atomically
 */
export async function moveToFinalDestination(
  tempPath: string,
  finalPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(finalPath);
    await fs.mkdir(destDir, { recursive: true });

    // Atomic rename
    await fs.rename(tempPath, finalPath);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה בהעברת הקובץ",
    };
  }
}

/**
 * Cleanup temporary file
 */
export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await fs.unlink(tempPath);
  } catch {
    // Ignore errors - file may not exist
  }
}
