import type { AnalysisResult } from "@/app/actions/analyzeText";

type StreamEvent =
  | { type: "field"; field: keyof AnalysisResult; value: unknown }
  | { type: "done"; result: AnalysisResult; streamed: boolean }
  | { type: "error"; message: string }
  | { type: "ping" };

export class StreamCancelledError extends Error {
  constructor(message = "Analysis cancelled") {
    super(message);
    this.name = "StreamCancelledError";
  }
}

/** Thrown when the streaming endpoint itself can't be reached/used (non-OK
 *  response or missing body) — distinct from a user cancellation or a
 *  provider-level error so callers can explain why they switched paths. */
export class StreamUnavailableError extends Error {
  constructor(message = "Streaming analysis unavailable") {
    super(message);
    this.name = "StreamUnavailableError";
  }
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Runs an analysis over the SSE streaming endpoint, invoking `onField` as each
 * result section completes. Resolves with the full, authoritative result.
 *
 * Supports user cancellation via `signal` and a client-side timeout; both
 * surface as `StreamCancelledError` so callers don't mistake a cancel for a
 * provider failure.
 */
export async function streamAnalysis(
  text: string,
  onField: (field: keyof AnalysisResult, value: unknown) => void,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = options?.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort);
  }

  try {
    const response = await fetch("/api/analyze/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      // Surface a JSON error body (400/413/429) so the real message reaches
      // the user; otherwise report the streaming path as unavailable.
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) throw new Error(body.error);
      } catch {
        /* no usable error body — fall through to unavailable */
      }
      throw new StreamUnavailableError();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      let chunk: Uint8Array | undefined;
      let done: boolean;
      try {
        ({ done, value: chunk } = await reader.read());
      } catch {
        if (controller.signal.aborted) {
          throw new StreamCancelledError();
        }
        throw new Error("Streaming connection was interrupted");
      }

      buffer += decoder.decode(chunk ?? new Uint8Array(), { stream: !done });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          let payload: StreamEvent;
          try {
            payload = JSON.parse(line.slice(5).trim()) as StreamEvent;
          } catch {
            continue;
          }

          if (payload.type === "ping") continue;
          if (payload.type === "field") {
            onField(payload.field, payload.value);
          } else if (payload.type === "done") {
            return payload.result;
          } else if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }

      if (done) break;
    }

    if (controller.signal.aborted) {
      throw new StreamCancelledError(
        timedOut ? "Analysis timed out" : "Analysis cancelled"
      );
    }
    throw new Error("Stream ended without a result");
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
