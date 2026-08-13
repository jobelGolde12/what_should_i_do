import { aiClient } from "@/lib/ai";
import { buildReplyMessages, TONE_PRESETS, type ReplyTone } from "@/lib/prompts";
import { fallbackReply } from "@/lib/replyFallback";
import { getErrorMessage } from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { logRequest } from "@/lib/log";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate, limitsForUser, planForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached } from "@/lib/pro/usage";
import type { AnalysisResult } from "@/app/actions/analyzeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSSE(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function isReplyTone(value: unknown): value is ReplyTone {
  return typeof value === "string" && value in TONE_PRESETS;
}

type Body = {
  message?: unknown;
  tone?: unknown;
  analysis?: Partial<AnalysisResult> | null;
};

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId =
    req.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const userId = await getCurrentUserId();

  const denied = await proGate(userId);
  if (denied) return denied;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* handled below */
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const tone: ReplyTone | null = isReplyTone(body.tone) ? body.tone : null;

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is empty." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!tone) {
    return new Response(JSON.stringify({ error: "Pick a valid tone." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const limits = await limitsForUser(userId);
  if (message.length > limits.maxMessageChars) {
    return new Response(
      JSON.stringify({
        error: `Message must be at most ${limits.maxMessageChars} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const rl = rateLimit(getClientIp(req), userId ? 30 : 5);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Try again in a minute." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const allowed = await tryIncrement(
    userId as string,
    "reply_drafts",
    limits.replyDraftsPerDay
  );
  if (!allowed) return limitReached("reply_drafts");

  const analysis = body.analysis ?? {};

  logRequest(requestId, "reply/stream", {
    chars: message.length,
    tone,
    plan: await planForUser(userId),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encodeSSE(obj));
      const heartbeat = setInterval(() => {
        try {
          send({ type: "ping" });
        } catch {
          clearInterval(heartbeat);
        }
      }, 10_000);

      try {
        const messages = buildReplyMessages({
          message,
          analysis: {
            actions: analysis.actions ?? [],
            deadlines: analysis.deadlines ?? [],
            urgency: analysis.urgency ?? "Informational",
            summary: analysis.summary ?? "",
          },
          tone,
        });

        const { content } = await aiClient.streamText(messages, (acc) => {
          send({ type: "text", draft: acc });
        }, { maxTokens: 1_200 });

        const draft = content.trim();
        if (!draft) throw new Error("Empty reply draft");
        send({ type: "done", draft, method: "ai" });
      } catch (error) {
        console.warn(
          "Reply streaming failed, falling back to template:",
          getErrorMessage(error)
        );
        try {
          const draft = fallbackReply(message, {
            actions: analysis.actions ?? [],
            deadlines: analysis.deadlines ?? [],
            urgency: analysis.urgency ?? "Informational",
            summary: analysis.summary ?? "",
            confusingParts: analysis.confusingParts ?? [],
          }, tone);
          send({ type: "done", draft, method: "fallback" });
        } catch (fallbackError) {
          send({
            type: "error",
            message:
              `Couldn't draft a reply. ${getErrorMessage(fallbackError)}. ` +
              "Try again.",
          });
        }
      } finally {
        clearInterval(heartbeat);
        logRequest(requestId, "reply/stream", {
          chars: message.length,
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
