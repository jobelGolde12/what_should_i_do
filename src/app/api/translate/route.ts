import { NextRequest } from "next/server";
import { createError } from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { limitsForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached } from "@/lib/pro/usage";

export const runtime = "nodejs";

/* =========================================================
   Server-side translation proxy.
   - Hides provider details from the client
   - In-memory cache keyed by (textHash, targetLang)
   - Timeouts via AbortController
   - Chunking to stay within MyMemory's request limits
   ========================================================= */

const MAX_CHUNK_CHARS = 480;
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Matches the languages offered in the UI (TranslationBlock). Keeps invalid
// 2-letter codes from reaching the provider and returning an opaque 502.
const SUPPORTED_LANGS = new Set(["tl", "es", "fr", "de", "it", "pt"]);

const cache = new Map<
  string,
  { value: string; expires: number }
>();

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if ((current + sentence).length > MAX_CHUNK_CHARS) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

async function translateChunk(chunk: string, target: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      chunk
    )}&langpair=en|${encodeURIComponent(target)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw createError(
        `Translation provider returned ${res.status}`,
        "NETWORK_ERROR",
        true
      );
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
      responseDetails?: string;
    };
    if (
      !data?.responseData?.translatedText ||
      (data.responseStatus && data.responseStatus !== 200)
    ) {
      throw createError(
        `Translation provider error: ${data.responseDetails ?? "no result"}`,
        "NETWORK_ERROR",
        true
      );
    }
    return data.responseData.translatedText;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), 30);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many translations. Try again in a minute." },
      { status: 429 }
    );
  }

  const userId = await getCurrentUserId();
  const limits = await limitsForUser(userId);

  let body: { text?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const target =
    typeof body.target === "string" ? body.target.toLowerCase() : "";

  if (!text) {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > limits.maxMessageChars) {
    return Response.json(
      { error: "Text is too long to translate." },
      { status: 413 }
    );
  }
  if (!SUPPORTED_LANGS.has(target)) {
    return Response.json(
      { error: "Unsupported target language" },
      { status: 400 }
    );
  }

  // Per-user daily translation quota.
  if (userId) {
    const allowed = await tryIncrement(
      userId,
      "translations",
      limits.translationsPerDay
    );
    if (!allowed) return limitReached("translations");
  }

  const cacheKey = `${hashText(text)}:${target}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return Response.json({ translated: cached.value, cached: true });
  }

  try {
    const chunks = splitIntoChunks(text);
    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
      translatedChunks.push(await translateChunk(chunk, target));
    }
    const translated = translatedChunks.join(" ");

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, {
      value: translated,
      expires: Date.now() + CACHE_TTL_MS,
    });

    return Response.json({ translated, cached: false });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Translation failed";
    return Response.json(
      { error: message },
      { status: 502 }
    );
  }
}
