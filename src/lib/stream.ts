import type { AnalysisResult } from "@/app/actions/analyzeText";

type StreamEvent =
  | { type: "field"; field: keyof AnalysisResult; value: unknown }
  | { type: "done"; result: AnalysisResult; streamed: boolean }
  | { type: "error"; message: string };

/**
 * Runs an analysis over the SSE streaming endpoint, invoking `onField` as each
 * result section completes. Resolves with the full, authoritative result.
 */
export async function streamAnalysis(
  text: string,
  onField: (field: keyof AnalysisResult, value: unknown) => void
): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming analysis unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

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

  throw new Error("Stream ended without a result");
}
