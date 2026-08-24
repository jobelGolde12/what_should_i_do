/**
 * OpenRouter-only chat transport for Chat Mode.
 *
 * Responsibilities (kept out of React components and route handlers):
 * - Request construction against the OpenAI-compatible
 *   `POST {baseUrl}/chat/completions` endpoint with `stream: true`.
 * - SSE parsing, including OpenRouter keep-alive comment lines and mid-stream
 *   errors (which arrive as chunks carrying an `error` object after HTTP 200).
 * - Controlled retries: ONLY before any content has streamed, and only for
 *   transient conditions (network failure, timeout, HTTP 5xx). Rate limits
 *   are retried solely when the provider supplies an explicit, short
 *   `Retry-After`. Auth/validation/quota errors never retry.
 * - Timeout handling via an idle watchdog: the stream is aborted only when no
 *   bytes arrive for `timeoutMs`, so long healthy streams aren't killed.
 * - Error normalization into `ChatProviderError` with a coarse `kind` — raw
 *   provider messages never reach the client (the route maps kinds to copy).
 * - Provider metadata capture: because `openrouter/free` routes each request
 *   to a different underlying free model, the actually-used model (from the
 *   response/chunk `model` field) is returned for observability.
 */

import {
  type ChatProviderConfig,
  type ResolvedChatConfig,
  resolveChatConfig,
} from "@/lib/chat/config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ChatStreamResult = {
  content: string;
  /** Underlying model OpenRouter actually routed to (may differ per request). */
  actualModel?: string;
  tokenUsage?: ChatTokenUsage;
  latencyMs: number;
  attempts: number;
};

export type ChatErrorKind =
  | "unconfigured"
  | "auth"
  | "rate-limit"
  | "quota"
  | "timeout"
  | "network"
  | "invalid-response"
  | "provider";

const RETRY_BASE_MS = 500;
const RETRY_JITTER_MS = 200;
/** Upper bound for honoring a provider Retry-After hint automatically. */
const MAX_RETRY_AFTER_MS = 30_000;

export class ChatProviderError extends Error {
  kind: ChatErrorKind;
  status?: number;
  providerCode?: string;
  /** Provider-supplied retry hint (rate limits), normalized to ms. */
  retryAfterMs?: number;

  constructor(
    message: string,
    kind: ChatErrorKind,
    meta: {
      status?: number;
      providerCode?: string;
      retryAfterMs?: number;
    } = {}
  ) {
    super(message);
    this.name = "ChatProviderError";
    this.kind = kind;
    this.status = meta.status;
    this.providerCode = meta.providerCode;
    this.retryAfterMs = meta.retryAfterMs;
  }
}

/** Raised only when the CALLER's own signal cancelled the request. */
export class ChatCancelledError extends Error {
  constructor(message = "Chat request cancelled") {
    super(message);
    this.name = "ChatCancelledError";
  }
}

/* =========================================================
   Error classification
   ========================================================= */

/** Explicit billing/credit exhaustion only — never 429 throttling. */
function quotaPhrases(message: string): boolean {
  const phrases = [
    "out of credits",
    "insufficient credits",
    "insufficient balance",
    "credit limit",
    "no credits",
    "zero balance",
    "billing limit",
  ];
  return phrases.some((p) => message.includes(p));
}

type ProviderErrorBody = {
  error?: {
    message?: string;
    code?: number | string;
    metadata?: { error_type?: string };
  };
  message?: string;
};

/**
 * Normalizes any failure into a ChatProviderError. Provider prose is kept on
 * the error for SERVER-side logs only; callers must map `kind` to safe copy.
 */
export function normalizeChatError(error: unknown): ChatProviderError {
  if (error instanceof ChatProviderError) return error;

  if (error instanceof Error && error.name === "AbortError") {
    return new ChatProviderError("Request timed out", "timeout");
  }

  if (error instanceof TypeError) {
    // fetch() network failures surface as TypeError ("fetch failed", ...).
    return new ChatProviderError("Network error", "network");
  }

  const e = error as Error & { status?: number };
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = (e?.message ?? "").toLowerCase();

  if (status === 401 || status === 403) {
    return new ChatProviderError(e?.message || "Authentication failed", "auth", {
      status,
    });
  }
  // 429 is temporary throttling — checked BEFORE prose matching so billing
  // phrases inside a rate-limit message are never misclassified as quota.
  if (status === 429) {
    return new ChatProviderError(e?.message || "Rate limited", "rate-limit", {
      status,
    });
  }
  if (status === 402 || quotaPhrases(message)) {
    return new ChatProviderError(e?.message || "Credits exhausted", "quota", {
      status,
    });
  }

  return new ChatProviderError(
    e?.message || "Unknown provider error",
    "provider",
    { status }
  );
}

function isTransientKind(kind: ChatErrorKind): boolean {
  return kind === "network" || kind === "timeout" || kind === "provider";
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  const reset = headers.get("x-ratelimit-reset");

  const candidates: Array<string | null> = [raw, reset];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const seconds = Number(candidate);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
    const asDate = Date.parse(candidate);
    if (!Number.isNaN(asDate)) {
      return Math.min(Math.max(asDate - Date.now(), 0), MAX_RETRY_AFTER_MS);
    }
  }
  return undefined;
}

async function readErrorResponse(response: Response): Promise<ChatProviderError> {
  let body: ProviderErrorBody = {};
  try {
    body = (await response.json()) as ProviderErrorBody;
  } catch {
    /* non-JSON error body — fall through to status-based classification */
  }

  const message =
    body?.error?.message ?? body?.message ?? `HTTP ${response.status}`;

  const codeRaw = body?.error?.code;
  const providerCode =
    typeof codeRaw === "number"
      ? String(codeRaw)
      : typeof codeRaw === "string"
        ? codeRaw
        : body?.error?.metadata?.error_type;

  const base = normalizeChatError(
    Object.assign(new Error(message), { status: response.status })
  );

  return new ChatProviderError(base.message, base.kind, {
    status: response.status,
    providerCode,
    retryAfterMs:
      base.kind === "rate-limit" ? parseRetryAfterMs(response.headers) : undefined,
  });
}

/* =========================================================
   SSE parsing
   ========================================================= */

type StreamChunk = {
  model?: string;
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: number | string;
    metadata?: { error_type?: string };
  };
};

/**
 * Reads an OpenAI-compatible SSE body, forwarding accumulated text via
 * `onDelta`. Throws ChatProviderError on malformed/mid-stream failures once
 * classified; `onModel` captures the underlying model when first seen.
 */
async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (accumulated: string) => void,
  onModel: (model: string) => void
): Promise<{ content: string; tokenUsage?: ChatTokenUsage }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let accumulated = "";
  let tokenUsage: ChatTokenUsage | undefined;

  const handleChunkData = (data: string): boolean => {
    // `[DONE]` terminates the OpenAI-compatible stream.
    if (data === "[DONE]") return false;

    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(data) as StreamChunk;
    } catch {
      // Tolerate keep-alive noise / partial frames; never kill the stream
      // for a single unparsable event.
      return true;
    }

    if (chunk.model) onModel(chunk.model);

    if (chunk.error) {
      const codeRaw = chunk.error.code;
      const err = normalizeChatError(
        Object.assign(new Error(chunk.error.message || "Streaming error"), {
          status:
            typeof codeRaw === "number"
              ? codeRaw
              : codeRaw === "rate_limit_exceeded" ||
                  chunk.error.metadata?.error_type === "rate_limit_exceeded"
                ? 429
                : undefined,
        })
      );
      throw err;
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

    return true;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();

      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      // SSE frames are separated by a blank line; comment lines (`:` prefix)
      // carry OpenRouter processing keep-alives and are ignored implicitly.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          if (!handleChunkData(trimmed.slice(5).trim())) return { content: accumulated, tokenUsage };
        }
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  return { content: accumulated, tokenUsage };
}

/* =========================================================
   Public entry point
   ========================================================= */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  return RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * RETRY_JITTER_MS;
}

export type StreamChatOptions = {
  /** Caller-side cancellation (e.g. client disconnects). */
  signal?: AbortSignal;
  config?: ChatProviderConfig;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Streams one chat completion from OpenRouter. Retries transient failures
 * with exponential backoff ONLY while nothing has been delivered; once the
 * first delta streams, any failure propagates immediately so callers can
 * keep partial content without duplicated output.
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (accumulated: string) => void,
  options: StreamChatOptions = {}
): Promise<ChatStreamResult> {
  const resolved: ResolvedChatConfig = options.config
    ? { ok: true, config: options.config }
    : resolveChatConfig();

  if (!resolved.ok) {
    throw new ChatProviderError("Chat provider is not configured", "unconfigured");
  }
  const config = resolved.config;

  const startedAt = Date.now();
  let lastError: ChatProviderError | null = null;
  let deliveredAny = false;
  // A provider Retry-After hint buys at most ONE extra attempt — free-tier
  // daily limits make further in-request waiting pointless.
  let retryAfterUsed = false;

  const trackedOnDelta = (acc: string) => {
    deliveredAny = true;
    onDelta(acc);
  };

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    // Fresh AbortController per attempt: the idle watchdog must not leak
    // across retries, and caller cancellation must always win.
    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", onExternalAbort);
    }

    // Idle watchdog: abort only when the stream stalls for `timeoutMs`.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, config.timeoutMs);
    };

    let actualModel: string | undefined;

    try {
      armIdleTimer();

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          // OpenRouter attribution headers (recommended app identification).
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://taskmind.app",
          "X-Title": "TaskMind",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: options.temperature ?? config.temperature,
          max_tokens: options.maxTokens ?? config.maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await readErrorResponse(response);
      }

      if (!response.body) {
        throw new ChatProviderError(
          "Streaming response has no body",
          "invalid-response"
        );
      }

      const { content, tokenUsage } = await consumeSseStream(
        response.body,
        trackedOnDelta,
        (model) => {
          actualModel = model;
        }
      );

      if (!content.trim()) {
        throw new ChatProviderError(
          "Empty response from AI provider",
          "invalid-response"
        );
      }

      return {
        content,
        actualModel,
        tokenUsage,
        latencyMs: Date.now() - startedAt,
        attempts: attempt,
      };
    } catch (error) {
      // Caller cancellation is not a provider failure and never retries.
      if (options.signal?.aborted) throw new ChatCancelledError();

      // Idle watchdog fired → surface as a timeout regardless of how the
      // underlying abort surfaced.
      const normalized =
        timedOut && error instanceof Error && error.name === "AbortError"
          ? new ChatProviderError("Request timed out", "timeout")
          : normalizeChatError(error);
      lastError = normalized;

      // Partial delivery is final: never retry (would duplicate deltas).
      if (deliveredAny) throw normalized;

      // Rate limits: honor only an explicit, short provider hint — once.
      if (
        normalized.kind === "rate-limit" &&
        !retryAfterUsed &&
        normalized.retryAfterMs !== undefined
      ) {
        retryAfterUsed = true;
        await delay(normalized.retryAfterMs);
        continue;
      }

      if (isTransientKind(normalized.kind) && attempt < config.maxAttempts) {
        await delay(backoffDelay(attempt));
        continue;
      }

      throw normalized;
    } finally {
      clearTimeout(idleTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  // Unreachable (loop always returns or throws) — kept for exhaustiveness.
  throw (
    lastError ??
    new ChatProviderError("Chat request failed", "provider")
  );
}
