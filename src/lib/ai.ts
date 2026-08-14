/**
 * Provider-agnostic AI client with a multi-tier fallback cascade.
 *
 * Stage 1 — TokenRouter (primary, OpenAI-compatible gateway)
 * Stage 2 — OpenRouter (secondary fallback)
 * Stage 3 — rule-based fallback (handled by callers: analyzeText / stream route)
 *
 * Design notes:
 * - Each provider is an `AIProviderBase` with its own config, transport,
 *   per-model routing, and retry/backoff behavior.
 * - Independent circuit breakers: one per provider (skip to OpenRouter when
 *   TokenRouter is tripped) plus the per-model route breaker.
 * - Every provider response routes through the single schema validation +
 *   repair engine in `validateAnalysis`.
 * - Quota exhaustion errors (402/out-of-credits) are propagated to callers so
 *   the UI can surface them instead of silently degrading to rule-based output.
 * - Telemetry/diagnostics never stores the input text (zero PII).
 */
import type { AnalysisResult } from "@/app/actions/analyzeText";
import { buildAnalysisMessages, PROMPT_VERSION } from "@/lib/prompts";
import { analyzeRawResponse } from "@/lib/validateAnalysis";
import { createError, getErrorMessage, AnalysisError } from "@/lib/errors";

export type ProviderName = "tokenrouter" | "openrouter";

const DEFAULT_BASE_URL = "https://api.tokenrouter.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "meta-llama/llama-3.3-70b-instruct",
];
const MAX_INPUT_CHARS = Number(process.env.TOKENROUTER_MAX_INPUT_CHARS ?? 20_000);
const RETRY_BASE_MS = 500;
const RETRY_JITTER_MS = 200;

export type AIUsage = {
  provider: ProviderName;
  model: string | undefined;
  /** 1-based attempt index within the winning provider. */
  attempt: number;
  /** Attempts consumed within the winning provider (not cumulative across
   *  the provider cascade — a fallback success may report 1/1). */
  attempts: number;
  latencyMs: number;
  repaired: boolean;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type AIClientResult = {
  result: AnalysisResult;
  usage: AIUsage;
};

export type AIStreamResult = {
  content: string;
  usage: AIUsage;
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string };
}

interface ChatStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string };
}

/* =========================================================
   Error classification
   ========================================================= */

function isTransient(error: unknown): boolean {
  const e = error as Error & { status?: number; code?: string };
  if (!e) return false;
  const message = e.message?.toLowerCase() ?? "";
  return (
    e.name === "AbortError" ||
    e.code === "aborted" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    e.status === 503 ||
    e.status === 504
  );
}

function isRetryableStatus(error: unknown): boolean {
  const e = error as Error & { status?: number };
  return e.status === 429 || (e.status !== undefined && e.status >= 500);
}

function isQuotaError(error: unknown): boolean {
  const e = error as Error & { status?: number; code?: string };
  const message = `${e.message ?? ""} ${e.code ?? ""}`.toLowerCase();
  return (
    e.status === 402 ||
    message.includes("credit") ||
    message.includes("quota") ||
    message.includes("insufficient") ||
    message.includes("billing") ||
    message.includes("balance") ||
    e.code === "insufficient_user_quota" ||
    e.code === "insufficient_credits"
  );
}

/**
 * Wraps a failure into a retryable AnalysisError while preserving the
 * underlying provider status/code so telemetry can record the real cause.
 */
function wrapFailure(message: string, cause: unknown): AnalysisError {
  const err = createError(message, "UNKNOWN_ERROR", true);
  const c = cause as Error & { status?: number; code?: string };
  if (typeof c?.status === "number") {
    (err as Error & { status?: number }).status = c.status;
  }
  if (typeof c?.code === "string") {
    (err as Error & { status?: number; code?: string }).code = c.code;
  }
  return err;
}

/** Short, PII-free classification of a provider error for diagnostics. */
function errorClass(error: unknown): string {
  if (isQuotaError(error)) return "quota";
  const e = error as Error & { status?: number };
  if (isTransient(error)) return "transient";
  if (e.status === 429) return "rate-limit";
  if (typeof e.status === "number" && e.status >= 500) return `http-${e.status}`;
  if (error instanceof AnalysisError) return "schema";
  return "other";
}

/* =========================================================
   Circuit breaker (per-provider and per-model-route)
   ========================================================= */

class CircuitBreaker {
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private failures = new Map<string, number>();
  private openedAt = new Map<string, number>();

  constructor(opts: { threshold?: number; cooldownMs?: number } = {}) {
    this.threshold = opts.threshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
  }

  isOpen(key: string): boolean {
    const opened = this.openedAt.get(key);
    if (!opened) return false;
    if (Date.now() - opened > this.cooldownMs) {
      // Half-open: allow one probe.
      this.openedAt.delete(key);
      this.failures.delete(key);
      return false;
    }
    return true;
  }

  recordSuccess(key: string) {
    this.failures.delete(key);
    this.openedAt.delete(key);
  }

  recordFailure(key: string) {
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    if (count >= this.threshold) {
      this.openedAt.set(key, Date.now());
    }
  }

  snapshot(): Record<string, { failures: number; open: boolean }> {
    const out: Record<string, { failures: number; open: boolean }> = {};
    for (const [key, count] of this.failures) {
      out[key] = { failures: count, open: this.isOpen(key) };
    }
    return out;
  }
}

/* =========================================================
   Provider base (shared OpenAI-compatible transport)
   ========================================================= */

type ProviderConfig = {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  models: string[];
  deepModels: string[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxAttempts: number;
};

abstract class AIProviderBase {
  readonly name: ProviderName;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly models: string[];
  readonly deepModels: string[];
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly maxAttempts: number;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.models = config.models;
    this.deepModels = config.deepModels;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.timeoutMs = config.timeoutMs;
    this.maxAttempts = config.maxAttempts;
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /** Provider-specific headers (e.g. OpenRouter attribution). */
  protected extraHeaders(): Record<string, string> {
    return {};
  }

  private headers(stream: boolean): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...this.extraHeaders(),
      ...(stream ? { Accept: "text/event-stream" } : {}),
    };
  }

  /** Which model/route to try for a 1-based attempt index. */
  routeFor(attempt: number, models: string[] = this.models): string | undefined {
    if (models.length === 0) return undefined; // auto-route
    if (attempt <= 1) return models[0];
    return models[Math.min(attempt - 1, models.length - 1)];
  }

  private buildBody(
    messages: ChatMessage[],
    model: string | undefined,
    stream: boolean,
    json = true,
    maxTokens = this.maxTokens
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messages,
      temperature: this.temperature,
      max_tokens: maxTokens,
    };
    if (json) body.response_format = { type: "json_object" };
    if (model) body.model = model;
    if (stream) body.stream = true;
    return body;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        const err = new Error(
          `Request timed out after ${Math.round(this.timeoutMs / 1000)}s`
        );
        err.name = "AbortError";
        throw err;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const data = await response.json().catch(() => ({}));
    const message =
      data?.error?.message || data?.message || `HTTP ${response.status}`;
    const code = data?.error?.code;
    const error = new Error(message);
    (error as Error & { status?: number; code?: string }).status = response.status;
    (error as Error & { status?: number; code?: string }).code = code;
    throw error;
  }

  /** Waits with exponential backoff + jitter (no-op for non-transient). */
  async backoff(attempt: number, error: unknown): Promise<void> {
    if (!isTransient(error) && !isRetryableStatus(error)) return;
    const base = RETRY_BASE_MS * 2 ** (attempt - 1);
    const jitter = Math.round(Math.random() * RETRY_JITTER_MS);
    await new Promise((resolve) => setTimeout(resolve, base + jitter));
  }

  async requestChat(
    messages: ChatMessage[],
    model: string | undefined
  ): Promise<{ content: string; tokenUsage?: AIUsage["tokenUsage"] }> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.headers(false),
        body: JSON.stringify(this.buildBody(messages, model, false)),
      }
    );
    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data = (await response.json()) as ChatResponse;

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Empty response from AI provider");
    }

    return {
      content: data.choices[0].message.content,
      tokenUsage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async streamFromModel(
    messages: ChatMessage[],
    model: string | undefined,
    onDelta: (accumulated: string) => void,
    json = true,
    maxTokens = this.maxTokens
  ): Promise<{ content: string; tokenUsage?: AIUsage["tokenUsage"] }> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(this.buildBody(messages, model, true, json, maxTokens)),
      }
    );

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new Error("Streaming response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let done = false;
    let tokenUsage: AIUsage["tokenUsage"];

    while (!done) {
      const { done: finished, value } = await reader.read();
      done = finished;
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !finished });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }

        let chunk: ChatStreamChunk;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        if (chunk.error) {
          throw new Error(chunk.error.message || "Streaming error from AI provider");
        }

        if (chunk.usage) {
          tokenUsage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onDelta(accumulated);
        }
      }
    }

    if (!accumulated.trim()) {
      throw new Error("Empty streaming response from AI provider");
    }

    return { content: accumulated, tokenUsage };
  }
}

/* =========================================================
   TokenRouter — primary provider
   ========================================================= */

class TokenRouterProvider extends AIProviderBase {
  constructor() {
    const models = [
      process.env.TOKENROUTER_MODEL?.trim(),
      ...(process.env.TOKENROUTER_MODEL_FALLBACKS ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ].filter((m): m is string => Boolean(m));
    const deepModels = [
      process.env.TOKENROUTER_MODEL_PRO?.trim(),
      ...models,
    ].filter((m): m is string => Boolean(m));
    super({
      name: "tokenrouter",
      apiKey: (process.env.TOKENROUTER_API_KEY ?? "").trim(),
      baseUrl: (
        process.env.TOKENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL
      ).replace(/\/+$/, ""),
      models,
      deepModels,
      temperature: Number(process.env.TOKENROUTER_TEMPERATURE ?? 0.1),
      maxTokens: Number(process.env.TOKENROUTER_MAX_TOKENS ?? 900),
      timeoutMs: Number(process.env.TOKENROUTER_TIMEOUT_MS ?? 60_000),
      maxAttempts: Number(process.env.TOKENROUTER_MAX_ATTEMPTS ?? 3),
    });
  }
}

/* =========================================================
   OpenRouter — secondary fallback provider
   ========================================================= */

class OpenRouterProvider extends AIProviderBase {
  constructor() {
    const configured = [
      process.env.OPENROUTER_MODEL?.trim(),
      ...(process.env.OPENROUTER_MODEL_FALLBACKS ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ].filter((m): m is string => Boolean(m));
    // OpenRouter requires an explicit model id (no auto-routing like
    // TokenRouter), so fall back to a curated default list when unset.
    const models = configured.length > 0 ? configured : [...OPENROUTER_DEFAULT_MODELS];
    super({
      name: "openrouter",
      apiKey: (process.env.OPENROUTER_API_KEY ?? "").trim(),
      baseUrl: (
        process.env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_BASE_URL
      ).replace(/\/+$/, ""),
      models,
      deepModels: models,
      temperature: Number(process.env.OPENROUTER_TEMPERATURE ?? 0.1),
      maxTokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 900),
      timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 60_000),
      maxAttempts: Number(process.env.OPENROUTER_MAX_ATTEMPTS ?? 2),
    });
  }

  protected extraHeaders(): Record<string, string> {
    return {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://taskmind.app",
      "X-Title": "TaskMind",
    };
  }
}

/* =========================================================
   Provider telemetry (zero PII — no input text is stored)
   ========================================================= */

export type ProviderErrorStats = {
  count: number;
  lastStatus?: number;
  lastCode?: string;
  lastClass?: string;
};

/* =========================================================
   AIClient — orchestrates the multi-tier cascade
   ========================================================= */

export class AIClient {
  private readonly primary: TokenRouterProvider;
  private readonly secondary: OpenRouterProvider;
  private readonly breaker = new CircuitBreaker();
  private readonly providerBreaker = new CircuitBreaker();
  private lastProviderUsed: ProviderName | null = null;
  private fallbackOccurred = false;
  private readonly providerErrors: Record<ProviderName, ProviderErrorStats> = {
    tokenrouter: { count: 0 },
    openrouter: { count: 0 },
  };

  constructor() {
    this.primary = new TokenRouterProvider();
    this.secondary = new OpenRouterProvider();
  }

  get configured(): boolean {
    return this.primary.configured || this.secondary.configured;
  }

  private get providers(): AIProviderBase[] {
    return [this.primary, this.secondary].filter((p) => p.configured);
  }

  private routeKey(provider: ProviderName, model: string | undefined): string {
    return `${provider}:${model ?? "auto"}`;
  }

  getDiagnostics() {
    return {
      provider: "tokenrouter",
      configured: this.configured,
      baseUrl: this.primary.baseUrl,
      model: this.primary.models[0] ?? null,
      fallbackModels: this.primary.models.slice(1),
      autoRoute: this.primary.models.length === 0,
      maxAttempts: this.primary.maxAttempts,
      timeoutMs: this.primary.timeoutMs,
      promptVersion: PROMPT_VERSION,
      circuitBreaker: this.breaker.snapshot(),
      // Secondary provider + telemetry.
      providers: {
        tokenrouter: {
          name: "tokenrouter",
          configured: this.primary.configured,
          baseUrl: this.primary.baseUrl,
          model: this.primary.models[0] ?? null,
          fallbackModels: this.primary.models.slice(1),
          autoRoute: this.primary.models.length === 0,
          maxAttempts: this.primary.maxAttempts,
          timeoutMs: this.primary.timeoutMs,
        },
        openrouter: {
          name: "openrouter",
          configured: this.secondary.configured,
          baseUrl: this.secondary.baseUrl,
          model: this.secondary.models[0] ?? null,
          fallbackModels: this.secondary.models.slice(1),
          maxAttempts: this.secondary.maxAttempts,
          timeoutMs: this.secondary.timeoutMs,
        },
      },
      providerCircuitBreaker: this.providerBreaker.snapshot(),
      lastProviderUsed: this.lastProviderUsed,
      fallbackOccurred: this.fallbackOccurred,
      providerErrors: this.providerErrors,
    };
  }

  private recordProviderError(
    provider: ProviderName,
    error: unknown,
    forceClass?: string
  ) {
    const entry = this.providerErrors[provider];
    entry.count += 1;
    const e = error as Error & { status?: number; code?: string };
    if (typeof e?.status === "number") entry.lastStatus = e.status;
    if (typeof e?.code === "string") entry.lastCode = e.code;
    entry.lastClass = forceClass ?? errorClass(error);
  }

  private normalizeInput(input: string): string {
    const cleaned = input.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    return cleaned.length > MAX_INPUT_CHARS
      ? cleaned.slice(0, MAX_INPUT_CHARS)
      : cleaned;
  }

  private guardAndBuild(input: string, deep = false): ChatMessage[] {
    if (!this.configured) {
      throw createError(
        "No AI provider configured (set TOKENROUTER_API_KEY or OPENROUTER_API_KEY)",
        "API_KEY_EXHAUSTED",
        true
      );
    }
    const normalized = this.normalizeInput(input);
    if (normalized.length < 10) {
      throw createError(
        "Text too short - please provide more content",
        "INPUT_TOO_SHORT"
      );
    }
    return buildAnalysisMessages(normalized, deep);
  }

  /**
   * Non-streaming structured analysis. Tries each configured provider in
   * cascade (TokenRouter → OpenRouter) with bounded per-provider attempts;
   * on total exhaustion throws so callers decide between rules-fallback or
   * surfacing the error (quota errors always propagate).
   */
  async analyzeStructured(input: string): Promise<AIClientResult> {
    const messages = this.guardAndBuild(input);
    const started = Date.now();
    const available = this.providers;
    let firstError: unknown;
    let attempted = 0;
    let quotaFailures = 0;

    for (const provider of available) {
      if (this.providerBreaker.isOpen(provider.name)) {
        const skipError = createError(
          `Provider "${provider.name}" is temporarily unavailable`,
          "NETWORK_ERROR",
          true
        );
        this.recordProviderError(provider.name, skipError, "breaker-open");
        if (!firstError) firstError = skipError;
        continue;
      }

      attempted += 1;
      try {
        const { result, usage } = await this.runStructuredAttempts(
          provider,
          messages,
          started
        );
        this.providerBreaker.recordSuccess(provider.name);
        this.lastProviderUsed = provider.name;
        this.fallbackOccurred =
          this.fallbackOccurred || provider.name !== "tokenrouter";
        result.aiProviderUsed = provider.name;
        return { result, usage };
      } catch (error: unknown) {
        this.providerBreaker.recordFailure(provider.name);
        this.recordProviderError(provider.name, error);
        if (!firstError) firstError = error;
        if (isQuotaError(error)) quotaFailures += 1;
      }
    }

    // Only report quota exhaustion when every provider that was actually
    // attempted hit a quota error (per the cascade contract). Otherwise the
    // first provider's error is the more honest story.
    if (quotaFailures > 0 && quotaFailures === attempted) {
      throw createError(
        "AI providers quota exhausted. Add credits or switch provider.",
        "ALL_KEYS_EXHAUSTED",
        false
      );
    }

    if (firstError instanceof AnalysisError) throw firstError;
    throw createError(
      `AI analysis failed: ${getErrorMessage(firstError)}`,
      "UNKNOWN_ERROR",
      true
    );
  }

  /** Bounded per-provider attempts across model routes. */
  private async runStructuredAttempts(
    provider: AIProviderBase,
    messages: ChatMessage[],
    started: number
  ): Promise<AIClientResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= provider.maxAttempts; attempt++) {
      const model = provider.routeFor(attempt);
      const route = this.routeKey(provider.name, model);

      if (this.breaker.isOpen(route)) {
        lastError = createError(
          `Route "${route}" is temporarily unavailable`,
          "NETWORK_ERROR",
          true
        );
        continue;
      }

      try {
        const { content, tokenUsage } = await provider.requestChat(messages, model);
        const { result, repaired } = analyzeRawResponse(content);
        this.breaker.recordSuccess(route);
        return {
          result,
          usage: {
            provider: provider.name,
            model,
            attempt,
            attempts: attempt,
            latencyMs: Date.now() - started,
            repaired,
            tokenUsage,
          },
        };
      } catch (error: unknown) {
        lastError = error;
        this.breaker.recordFailure(route);

        if (isQuotaError(error)) {
          throw createError(
            "AI provider quota exhausted. Add credits or switch provider.",
            "ALL_KEYS_EXHAUSTED",
            false
          );
        }

        if (error instanceof AnalysisError) {
          // Schema/JSON failures: retry on the next route immediately.
          if (attempt < provider.maxAttempts) continue;
          break;
        }

        if (isTransient(error) || isRetryableStatus(error)) {
          if (attempt < provider.maxAttempts) {
            await provider.backoff(attempt, error);
            continue;
          }
          break;
        }

        break; // non-retryable (4xx, auth, etc.)
      }
    }

    throw wrapFailure(
      `AI analysis failed after ${provider.maxAttempts} attempts: ${getErrorMessage(lastError)}`,
      lastError
    );
  }

  /**
   * Shared streaming retry loop for a single provider (structured JSON and
   * free-text streams). Partial streams are never retried (deltas would be
   * duplicated) — the error is thrown for the caller to handle.
   */
  private async runStream(
    provider: AIProviderBase,
    messages: ChatMessage[],
    onDelta: (accumulated: string) => void,
    json: boolean,
    maxTokens?: number,
    models?: string[]
  ): Promise<AIStreamResult> {
    const started = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= provider.maxAttempts; attempt++) {
      const model = provider.routeFor(attempt, models);
      const route = this.routeKey(provider.name, model);

      if (this.breaker.isOpen(route)) {
        lastError = createError(
          `Route "${route}" is temporarily unavailable`,
          "NETWORK_ERROR",
          true
        );
        continue;
      }

      let anyDelta = false;
      try {
        const { content, tokenUsage } = await provider.streamFromModel(
          messages,
          model,
          (acc) => {
            anyDelta = true;
            onDelta(acc);
          },
          json,
          maxTokens
        );
        this.breaker.recordSuccess(route);
        return {
          content,
          usage: {
            provider: provider.name,
            model,
            attempt,
            attempts: attempt,
            latencyMs: Date.now() - started,
            repaired: false,
            tokenUsage,
          },
        };
      } catch (error: unknown) {
        lastError = error;
        this.breaker.recordFailure(route);

        if (anyDelta) throw error; // partial stream — do not retry

        if (isQuotaError(error)) {
          throw createError(
            "AI provider quota exhausted. Add credits or switch provider.",
            "ALL_KEYS_EXHAUSTED",
            false
          );
        }

        if (error instanceof AnalysisError) {
          if (attempt < provider.maxAttempts) continue;
          break;
        }

        if (isTransient(error) || isRetryableStatus(error)) {
          if (attempt < provider.maxAttempts) {
            await provider.backoff(attempt, error);
            continue;
          }
          break;
        }

        break;
      }
    }

    throw wrapFailure(
      `AI streaming failed after ${provider.maxAttempts} attempts: ${getErrorMessage(lastError)}`,
      lastError
    );
  }

  /**
   * Runs a stream across the provider cascade. Falls back to the next provider
   * only when the previous one failed before any content was delivered; a
   * partial stream is re-thrown. Quota errors propagate to the caller.
   */
  private async streamWithFallback(
    messages: ChatMessage[],
    onDelta: (accumulated: string) => void,
    json: boolean,
    opts: {
      maxTokens?: number;
      models?: (provider: AIProviderBase) => string[] | undefined;
    } = {}
  ): Promise<AIStreamResult> {
    const available = this.providers;
    let firstError: unknown;
    let attempted = 0;
    let quotaFailures = 0;

    for (const provider of available) {
      if (this.providerBreaker.isOpen(provider.name)) {
        const skipError = createError(
          `Provider "${provider.name}" is temporarily unavailable`,
          "NETWORK_ERROR",
          true
        );
        this.recordProviderError(provider.name, skipError, "breaker-open");
        if (!firstError) firstError = skipError;
        continue;
      }

      attempted += 1;
      let deliveredAny = false;
      try {
        const streamResult = await this.runStream(
          provider,
          messages,
          (acc) => {
            deliveredAny = true;
            onDelta(acc);
          },
          json,
          opts.maxTokens,
          opts.models?.(provider)
        );
        this.providerBreaker.recordSuccess(provider.name);
        this.lastProviderUsed = provider.name;
        this.fallbackOccurred =
          this.fallbackOccurred || provider.name !== "tokenrouter";
        return streamResult;
      } catch (error: unknown) {
        this.providerBreaker.recordFailure(provider.name);
        this.recordProviderError(provider.name, error);
        if (deliveredAny) throw error; // partial stream — never fall back
        if (!firstError) firstError = error;
        if (isQuotaError(error)) quotaFailures += 1;
      }
    }

    if (quotaFailures > 0 && quotaFailures === attempted) {
      throw createError(
        "AI providers quota exhausted. Add credits or switch provider.",
        "ALL_KEYS_EXHAUSTED",
        false
      );
    }

    if (firstError instanceof AnalysisError) throw firstError;
    throw createError(
      `AI streaming failed: ${getErrorMessage(firstError)}`,
      "UNKNOWN_ERROR",
      true
    );
  }

  /**
   * Streaming structured analysis. Returns the accumulated raw JSON text and
   * usage. Once any content has streamed, failures are not retried (they would
   * duplicate deltas); the caller decides how to handle the partial stream.
   * `deep` uses the higher-effort prompt and the Pro model tier when configured.
   */
  async streamStructured(
    input: string,
    onDelta: (accumulated: string) => void,
    opts: { deep?: boolean; maxTokens?: number } = {}
  ): Promise<AIStreamResult> {
    const messages = this.guardAndBuild(input, opts.deep ?? false);
    return this.streamWithFallback(messages, onDelta, true, {
      maxTokens: opts.maxTokens,
      models: (provider) => (opts.deep ? provider.deepModels : undefined),
    });
  }

  /**
   * Streaming free-text generation (e.g. reply drafts) from caller-provided
   * messages. Shares the same provider cascade + retry/backoff/circuit-breaker
   * path as the structured stream, minus JSON validation.
   */
  async streamText(
    messages: ChatMessage[],
    onDelta: (accumulated: string) => void,
    opts: { maxTokens?: number } = {}
  ): Promise<AIStreamResult> {
    return this.streamWithFallback(messages, onDelta, false, {
      maxTokens: opts.maxTokens,
    });
  }
}

export const aiClient = new AIClient();
