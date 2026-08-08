import { openRouterAPI } from "@/lib/openrouter";
import { runRuleAnalysis, normalizeAnalysisResult } from "@/lib/analyzeRules";
import {
  extractCompletedFields,
  stripFences,
  STREAM_FIELD_ORDER,
} from "@/lib/streamParse";
import { createError, getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSSE(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    text = "";
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encodeSSE(obj));

      try {
        if (!text) {
          throw createError("Text is empty", "INPUT_TOO_SHORT");
        }
        if (text.length < 10) {
          throw createError(
            "Text too short - please provide more content",
            "INPUT_TOO_SHORT"
          );
        }

        // Stream from OpenRouter, revealing fields as they complete.
        const previous = new Set<string>();
        let completedAny = false;

        const content = await openRouterAPI.streamRaw(text, (accumulated) => {
          const fields = extractCompletedFields(
            accumulated,
            STREAM_FIELD_ORDER,
            previous
          );
          for (const [field, value] of Object.entries(fields)) {
            previous.add(field);
            completedAny = true;
            send({ type: "field", field, value });
          }
        });

        // Final authoritative result (handles fields that streamed partially).
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(stripFences(content)) as Record<string, unknown>;
        } catch {
          throw createError(
            "Invalid JSON response from OpenRouter",
            "INVALID_JSON"
          );
        }

        const result = normalizeAnalysisResult(parsed);
        send({ type: "done", result, streamed: completedAny });
      } catch (error: unknown) {
        // Fall back to the rule-based analyser (mirrors the server action).
        const message = getErrorMessage(error);
        console.warn("Streaming analysis failed, falling back to rules:", message);

        if (text.length < 10) {
          send({
            type: "error",
            message: "Text too short - please provide more content.",
          });
        } else {
          try {
            const result = runRuleAnalysis(text);
            send({ type: "done", result, streamed: false });
          } catch (fallbackError: unknown) {
            send({
              type: "error",
              message:
                `Couldn't analyze that. ${getErrorMessage(fallbackError)}. ` +
                "Try again with different text.",
            });
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
