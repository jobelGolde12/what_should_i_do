import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  startModelLoad,
  isModelReady,
  getSummarizer,
} from "@/lib/summarizer";

export const runtime = "nodejs";

const MAX_TEXT_CHARS = 20_000;

// Text-hash → summary cache with a small cap so memory stays bounded.
const cache = new Map<string, { summary: string; model: string }>();
const CACHE_LIMIT = 200;

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function cacheSet(key: string, value: { summary: string; model: string }) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** Extractive fallback used while the model is warming: first 2-3 sentences. */
function extractiveFallback(text: string): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const picked = sentences.slice(0, 3).join(" ");
  return picked.length > 40 ? picked : text.trim().slice(0, 280);
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { text?: unknown; max_length?: unknown; min_length?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 20) {
    return NextResponse.json(
      { error: "Text must be at least 20 characters." },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: `Text must be at most ${MAX_TEXT_CHARS} characters.` },
      { status: 413 }
    );
  }

  const maxLength = Math.min(
    typeof body.max_length === "number" ? body.max_length : 100,
    150
  );
  const minLength = Math.min(
    typeof body.min_length === "number" ? body.min_length : 30,
    50
  );

  const key = hashText(`${text}:${maxLength}:${minLength}`);
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  // Cold start: kick the model load off in the background and serve the
  // extractive fallback NOW so the first request never blows the client
  // timeout. Once the model is ready it's used for all subsequent requests.
  if (!isModelReady()) {
    if (!getSummarizer()) startModelLoad();
    const summary = extractiveFallback(text);
    const value = { summary, model: "extractive-fallback" };
    cacheSet(key, value);
    return NextResponse.json({ ...value, cached: false, warming: true });
  }

  try {
    const summarizer = (await getSummarizer())!;
    const result = (await summarizer(text, {
      max_length: maxLength,
      min_length: minLength,
      do_sample: false,
    })) as { summary_text?: string }[];

    const summary = result?.[0]?.summary_text?.trim();
    if (!summary) {
      throw new Error("Model returned an empty summary.");
    }

    const value = { summary, model: "distilbart-cnn-12-6" };
    cacheSet(key, value);
    return NextResponse.json({ ...value, cached: false });
  } catch (error) {
    // Graceful degradation: the offline model may be unavailable on some
    // platforms; still deliver a usable summary instead of failing.
    console.error("[summarize] Model failed, using extractive fallback:", error);
    const summary = extractiveFallback(text);
    const value = { summary, model: "extractive-fallback" };
    cacheSet(key, value);
    return NextResponse.json({ ...value, cached: false });
  }
}
