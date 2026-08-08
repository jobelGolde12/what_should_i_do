import { aiClient } from "@/lib/ai";
import { runRuleAnalysis } from "@/lib/analyzeRules";
import { validateAndRepairAnalysis } from "@/lib/validateAnalysis";
import {
  extractCompletedFields,
  STREAM_FIELD_ORDER,
} from "@/lib/streamParse";
import { createError, getErrorMessage } from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { logRequest } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT_CHARS = 20_000;

function encodeSSE(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId =
    req.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    text = "";
  }

  if (text.length > MAX_INPUT_CHARS) {
    return new Response(
      JSON.stringify({ error: `Text must be at most ${MAX_INPUT_CHARS} characters.` }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const rl = rateLimit(getClientIp(req), 15);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many analyses. Try again in a minute." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  logRequest(requestId, "analyze/stream", { chars: text.length });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encodeSSE(obj));

      // Heartbeat keeps the connection alive across proxies while the model
      // is still generating (no field events may be emitted for a while).
      const heartbeat = setInterval(() => {
        try {
          send({ type: "ping" });
        } catch {
          clearInterval(heartbeat);
        }
      }, 10_000);

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

        // Stream from the AI provider, revealing fields as they complete.
        const previous = new Set<string>();
        let completedAny = false;

        const { content } = await aiClient.streamStructured(text, (accumulated) => {
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

        // Final authoritative result (validates + repairs the streamed JSON,
        // salvaging truncated output where possible).
        const result = validateAndRepairAnalysis(content);
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
        clearInterval(heartbeat);
        logRequest(requestId, "analyze/stream", {
          chars: text.length,
          latencyMs: Date.now() - startedAt,
        });
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
