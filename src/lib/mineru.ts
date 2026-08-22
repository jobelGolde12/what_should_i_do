import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FileTooLargeError,
  FlashFileTooLargeError,
  FlashPageLimitError,
  MinerU,
} from "mineru-open-sdk";

/* =========================================================
   MinerU document → Markdown preprocessing.

   Supported files are converted to clean Markdown before they
   reach the AI model, cutting token cost vs. raw extraction.
   `.txt` files and unknown types bypass MinerU entirely.
   ========================================================= */

export const MINERU_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "docx",
  "pptx",
  "xlsx",
  "html",
  "htm",
] as const;

export const FLASH_MAX_BYTES = 10 * 1024 * 1024;
export const PRECISION_MAX_BYTES = 200 * 1024 * 1024;

const TIMEOUT_MS = Number(process.env.MINERU_TIMEOUT_MS) || 90_000;
const CACHE_MAX_ENTRIES = 20;
const CACHE_TTL_MS = 10 * 60_000;

type CacheEntry = { markdown: string; engine: MineruEngine; at: number };
const cache = new Map<string, CacheEntry>();

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

/**
 * True when the file should be converted to Markdown with MinerU.
 * Detection order mirrors the spec: known extension, or image MIME,
 * or HTML content type. Undeterminable types return false.
 */
export function isMineruCandidate(fileName: string, mimeType: string): boolean {
  const ext = extensionOf(fileName);

  if ((MINERU_EXTENSIONS as readonly string[]).includes(ext)) {
    return true;
  }

  if (mimeType.startsWith("image/")) {
    return true;
  }

  if (mimeType === "text/html") {
    return true;
  }

  return false;
}

export type MineruEngine = "mineru-flash" | "mineru-precision";

export type MineruResult = {
  markdown: string;
  engine: MineruEngine;
};

export class MineruUnsupportedError extends Error {}

export class MineruLimitError extends Error {
  constructor(message: string) {
    super(
      `${message} Files over 10 MB need a free MINERU_TOKEN (mineru.net/apiManage/token) for Precision mode.`
    );
  }
}

export class MineruTimeoutError extends Error {
  constructor() {
    super("Document conversion timed out.");
  }
}

function hasToken(): boolean {
  return Boolean(process.env.MINERU_TOKEN);
}

/** Wall-clock guard so the HTTP request never hangs on the SDK's polling. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new MineruTimeoutError()),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function cacheGet(key: string): Promise<CacheEntry | null> {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh recency for simple LRU behavior.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  cache.set(key, entry);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function friendlyMessage(error: unknown): string {
  if (
    error instanceof FlashFileTooLargeError ||
    error instanceof FileTooLargeError
  ) {
    return "That file is larger than the converter allows.";
  }
  if (error instanceof FlashPageLimitError) {
    return "That document has more pages than the fast converter allows.";
  }
  return "The document converter could not read this file. It may be corrupted or password-protected.";
}

/**
 * Convert an uploaded document to Markdown via the MinerU Open SDK.
 *
 * - Flash Extract (no token): PDF/images/DOCX/PPTX/XLSX up to 10 MB / 20 pages.
 * - Precision Extract (MINERU_TOKEN set): used when Flash limits are exceeded;
 *   supports up to 200 MB / 600 pages plus HTML input.
 * - Throws MineruUnsupportedError for files outside the supported set.
 */
export async function extractMarkdown({
  buffer,
  fileName,
  mimeType,
}: {
  buffer: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<MineruResult> {
  if (!isMineruCandidate(fileName, mimeType)) {
    throw new MineruUnsupportedError(
      `MinerU does not handle this file type. Pass it through unchanged.`
    );
  }

  const key = createHash("sha256")
    .update(buffer)
    .update(`${fileName}:${buffer.byteLength}`)
    .digest("hex");

  const cached = await cacheGet(key);
  if (cached) {
    return { markdown: cached.markdown, engine: cached.engine };
  }

  const usePrecision =
    hasToken() &&
    (buffer.byteLength > FLASH_MAX_BYTES || extensionOf(fileName) === "html" || extensionOf(fileName) === "htm");

  if (!usePrecision && buffer.byteLength > FLASH_MAX_BYTES) {
    throw new MineruLimitError(
      "This file is over the 10 MB fast-conversion limit."
    );
  }
  if (buffer.byteLength > PRECISION_MAX_BYTES) {
    throw new MineruLimitError("This file is over the 200 MB conversion limit.");
  }

  const ext = extensionOf(fileName) || "bin";
  const dir = await mkdtemp(path.join(tmpdir(), "taskmind-mineru-"));
  const filePath = path.join(dir, `input.${ext}`);

  try {
    await writeFile(filePath, buffer);

    const client = new MinerU(process.env.MINERU_TOKEN);
    const isImage = mimeType.startsWith("image/");

    const result = usePrecision
      ? await withTimeout(
          client.extract(filePath, {
            ocr: isImage ? true : undefined,
            timeout: Math.ceil(TIMEOUT_MS / 1000),
          }),
          TIMEOUT_MS
        )
      : await withTimeout(
          client.flashExtract(filePath, {
            ocr: isImage ? true : undefined,
            timeout: Math.ceil(TIMEOUT_MS / 1000),
          }),
          TIMEOUT_MS
        );

    const markdown = result.markdown?.trim() ?? "";

    if (!markdown) {
      throw new MineruUnsupportedError(
        "Conversion returned no text — likely a scanned or empty document."
      );
    }

    const engine: MineruEngine = usePrecision
      ? "mineru-precision"
      : "mineru-flash";
    cacheSet(key, { markdown, engine, at: Date.now() });

    return { markdown, engine };
  } catch (error) {
    if (
      error instanceof MineruUnsupportedError ||
      error instanceof MineruLimitError ||
      error instanceof MineruTimeoutError
    ) {
      throw error;
    }
    throw new Error(friendlyMessage(error));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
