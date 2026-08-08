/**
 * Provider-agnostic AI client (TokenRouter primary).
 *
 * OpenAI-compatible chat completions (non-streaming + streaming) against
 * `TOKENROUTER_BASE_URL` with `TOKENROUTER_API_KEY`. Provides:
 * - bounded multi-attempt routing (primary model → optional fallbacks → auto),
 * - exponential backoff + jitter for transient failures,
 * - a simple route circuit breaker,
 * - strict schema validation + repair of JSON output (see validateAnalysis),
 * - usage/diagnostics for observability (never logs the input text).
 */
import type { AnalysisResult } from "@/app/actions/analyzeText";
import { buildAnalysisMessages, PROMPT_VERSION } from "@/lib/prompts";
import { analyzeRawResponse } from "@/lib/validateAnalysis";
import { createError, getErrorMessage, AnalysisError } from "@/lib/errors";

const DEFAULT_BASE_URL = "https://api.tokenrouter.com/v1";
const MAX_INPUT_CHARS = 20_000;
const RETRY_BASE_MS = 500;
const RETRY_JITTER_MS = 200;

export type AIUsage = {
  model: string | undefined;
  attempt: number;
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

/* =========================================================
   Route circuit breaker
   ========================================================= */

class RouteCircuitBreaker {
  private readonly threshold = 3;
  private readonly cooldownMs = 30_000;
  private failures = new Map<string, number>();
  private openedAt = new Map<string, number>();

  isOpen(route: string): boolean {
    const opened = this.openedAt.get(route);
    if (!opened) return false;
    if (Date.now() - opened > this.cooldownMs) {
      // Half-open: allow one probe.
      this.openedAt.delete(route);
      this.failures.delete(route);
      return false;
    }
    return true;
  }

  recordSuccess(route: string) {
    this.failures.delete(route);
    this.openedAt.delete(route);
  }

  recordFailure(route: string) {
    const count = (this.failures.get(route) ?? 0) + 1;
    this.failures.set(route, count);
    if (count >= this.threshold) {
      this.openedAt.set(route, Date.now());
    }
  }

  snapshot(): Record<string, { failures: number; open: boolean }> {
    const out: Record<string, { failures: number; open: boolean }> = {};
    for (const [route, count] of this.failures) {
      out[route] = { failures: count, open: this.isOpen(route) };
    }
    return out;
  }
}

/* =========================================================
   AIClient
   ========================================================= */

export class AIClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly models: string[];
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly breaker = new RouteCircuitBreaker();

  constructor() {
    this.apiKey = (process.env.TOKENROUTER_API_KEY ?? "").trim();
    this.baseUrl = (
      process.env.TOKENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.models = [
      process.env.TOKENROUTER_MODEL?.trim(),
      ...(process.env.TOKENROUTER_MODEL_FALLBACKS ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ].filter((m): m is string => Boolean(m));
    this.temperature = Number(process.env.TOKENROUTER_TEMPERATURE ?? 0.1);
    this.maxTokens = Number(process.env.TOKENROUTER_MAX_TOKENS ?? 900);
    this.timeoutMs = Number(process.env.TOKENROUTER_TIMEOUT_MS ?? 60_000);
    this.maxAttempts = Number(process.env.TOKENROUTER_MAX_ATTEMPTS ?? 3);
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  getDiagnostics() {
    return {
      provider: "tokenrouter",
      configured: this.configured,
      baseUrl: this.baseUrl,
      model: this.models[0] ?? null,
      fallbackModels: this.models.slice(1),
      autoRoute: this.models.length === 0,
      maxAttempts: this.maxAttempts,
      timeoutMs: this.timeoutMs,
      promptVersion: PROMPT_VERSION,
      circuitBreaker: this.breaker.snapshot(),
    };
  }

  /** Which model/route to try for a 1-based attempt index. */
  private routeFor(attempt: number): string | undefined {
    if (this.models.length === 0) return undefined; // auto-route
    if (attempt <= 1) return this.models[0];
    return this.models[Math.min(attempt - 1, this.models.length - 1)];
  }

  private routeKey(model: string | undefined): string {
    return model ?? "auto";
  }

  private normalizeInput(input: string): string {
    const cleaned = input.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    return cleaned.length > MAX_INPUT_CHARS
      ? cleaned.slice(0, MAX_INPUT_CHARS)
      : cleaned;
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

  private buildBody(
    messages: ChatMessage[],
    model: string | undefined,
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: "json_object" },
    };
    if (model) body.model = model;
    if (stream) body.stream = true;
    return body;
  }

  private headers(stream: boolean): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
    };
  }

  private async requestChat(
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

  private async streamFromModel(
    messages: ChatMessage[],
    model: string | undefined,
    onDelta: (accumulated: string) => void
  ): Promise<{ content: string; tokenUsage?: AIUsage["tokenUsage"] }> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(this.buildBody(messages, model, true)),
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

  /** Waits with exponential backoff + jitter (no-op for non-transient). */
  private async backoff(attempt: number, error: unknown): Promise<void> {
    if (!isTransient(error) && !isRetryableStatus(error)) return;
    const base = RETRY_BASE_MS * 2 ** (attempt - 1);
    const jitter = Math.round(Math.random() * RETRY_JITTER_MS);
    await new Promise((resolve) => setTimeout(resolve, base + jitter));
  }

  private guardAndBuild(input: string): ChatMessage[] {
    if (!this.configured) {
      throw createError(
        "No AI provider configured (TOKENROUTER_API_KEY is missing)",
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
    return buildAnalysisMessages(normalized);
  }

  /**
   * Non-streaming structured analysis. Bounded attempts across routes; on
   * exhaustion throws so callers can decide between rules-fallback or error.
   */
  async analyzeStructured(input: string): Promise<AIClientResult> {
    const messages = this.guardAndBuild(input);
    const started = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const model = this.routeFor(attempt);
      const route = this.routeKey(model);

      if (this.breaker.isOpen(route)) {
        lastError = createError(
          `Route "${route}" is temporarily unavailable`,
          "NETWORK_ERROR",
          true
        );
        continue;
      }

      try {
        const { content, tokenUsage } = await this.requestChat(messages, model);
        const { result, repaired } = analyzeRawResponse(content);
        this.breaker.recordSuccess(route);
        return {
          result,
          usage: {
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
          if (attempt < this.maxAttempts) continue;
          break;
        }

        if (isTransient(error) || isRetryableStatus(error)) {
          if (attempt < this.maxAttempts) {
            await this.backoff(attempt, error);
            continue;
          }
          break;
        }

        break; // non-retryable (4xx, auth, etc.)
      }
    }

    const message = getErrorMessage(lastError);
    throw createError(
      `AI analysis failed after ${this.maxAttempts} attempts: ${message}`,
      "UNKNOWN_ERROR",
      true
    );
  }

  /**
   * Streaming structured analysis. Returns the accumulated raw JSON text and
   * usage. Once any content has streamed, failures are not retried (they would
   * duplicate deltas); the caller decides how to handle the partial stream.
   */
  async streamStructured(
    input: string,
    onDelta: (accumulated: string) => void
  ): Promise<AIStreamResult> {
    const messages = this.guardAndBuild(input);
    const started = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const model = this.routeFor(attempt);
      const route = this.routeKey(model);

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
        const { content, tokenUsage } = await this.streamFromModel(
          messages,
          model,
          (acc) => {
            anyDelta = true;
            onDelta(acc);
          }
        );
        this.breaker.recordSuccess(route);
        return {
          content,
          usage: {
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
          if (attempt < this.maxAttempts) continue;
          break;
        }

        if (isTransient(error) || isRetryableStatus(error)) {
          if (attempt < this.maxAttempts) {
            await this.backoff(attempt, error);
            continue;
          }
          break;
        }

        break;
      }
    }

    const message = getErrorMessage(lastError);
    throw createError(
      `AI streaming failed after ${this.maxAttempts} attempts: ${message}`,
      "UNKNOWN_ERROR",
      true
    );
  }
}

export const aiClient = new AIClient();
