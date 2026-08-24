/**
 * Chat Mode provider configuration (OpenRouter-only).
 *
 * Chat Mode deliberately does NOT share the analysis cascade in
 * `src/lib/ai.ts` (TokenRouter → OpenRouter → Zen): the chat endpoint must
 * talk to OpenRouter exclusively and never silently fall back to another
 * provider. See docs/chat-openrouter.md.
 *
 * Credential precedence (server-side only — never exposed to the client):
 * - API key:  OPENROUTER_CHAT_API_KEY ?? OPENROUTER_API_KEY
 * - Base URL: OPENROUTER_CHAT_BASE_URL ?? OPENROUTER_BASE_URL ?? official API
 * - Model:    OPENROUTER_CHAT_MODEL ?? "openrouter/free"
 *
 * `openrouter/free` is OpenRouter's Free Models Router — a stable LOGICAL id
 * that routes each request to one of the currently available free models,
 * filtered by the capabilities the request needs. Availability behind it
 * changes over time; never hardcode assumptions about a specific underlying
 * model. Free-tier limits currently: 20 req/min and 50 req/day for accounts
 * that have purchased <10 credits (1000 req/day otherwise).
 */

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_FREE_MODEL = "openrouter/free";

export type ChatProviderConfig = {
  apiKey: string;
  baseUrl: string;
  /** Logical model id — defaults to the Free Models Router. */
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxAttempts: number;
};

/** Reason the provider can't serve requests right now (diagnostics only). */
export type ChatConfigProblem =
  | "missing-api-key"
  | "invalid-base-url"
  | "invalid-model"
  | "invalid-tuning";

export type ResolvedChatConfig =
  | { ok: true; config: ChatProviderConfig }
  | { ok: false; problem: ChatConfigProblem };

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Resolves and validates the Chat Mode configuration at request time.
 * A missing chat key must degrade Chat Mode gracefully — it must never crash
 * app startup or break unrelated features that use other credentials.
 */
export function resolveChatConfig(env: NodeJS.ProcessEnv = process.env): ResolvedChatConfig {
  const apiKey = firstNonEmpty(
    env.OPENROUTER_CHAT_API_KEY,
    env.OPENROUTER_API_KEY
  );

  if (!apiKey) return { ok: false, problem: "missing-api-key" };

  const baseUrl =
    firstNonEmpty(env.OPENROUTER_CHAT_BASE_URL, env.OPENROUTER_BASE_URL) ??
    OPENROUTER_DEFAULT_BASE_URL;

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, problem: "invalid-base-url" };
    }
  } catch {
    return { ok: false, problem: "invalid-base-url" };
  }

  const model = firstNonEmpty(env.OPENROUTER_CHAT_MODEL) ?? OPENROUTER_FREE_MODEL;

  // Guard against whitespace-only / malformed overrides slipping through env.
  if (/[\s"']/.test(model)) return { ok: false, problem: "invalid-model" };

  const temperatureRaw = Number(env.OPENROUTER_CHAT_TEMPERATURE);
  const temperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 && temperatureRaw <= 2
      ? temperatureRaw
      : 0.2;

  const maxAttempts = Math.min(
    Math.floor(num(env.OPENROUTER_CHAT_MAX_ATTEMPTS, 3)),
    5
  );

  const config: ChatProviderConfig = {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    temperature,
    maxTokens: Math.min(num(env.OPENROUTER_CHAT_MAX_TOKENS, 800), 4000),
    timeoutMs: num(env.OPENROUTER_CHAT_TIMEOUT_MS, 45_000),
    maxAttempts,
  };

  return { ok: true, config };
}
