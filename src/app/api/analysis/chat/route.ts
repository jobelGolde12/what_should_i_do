import { aiClient } from "@/lib/ai";
import { buildChatMessages, type ChatHistoryMessage } from "@/lib/prompts";
import {
  AnalysisError,
  ERROR_CODES,
  getErrorMessage,
} from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { logRequest } from "@/lib/log";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { limitsForUser, planForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached } from "@/lib/pro/usage";
import type { AnalysisResult } from "@/app/actions/analyzeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSSE(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Classifies a provider failure into a short diagnostic tag (metadata only —
 * never sent to the client, never PII).
 */
function errorClass(error: unknown): "quota" | "unconfigured" | "provider" {
  if (error instanceof AnalysisError && error.code === ERROR_CODES.API_KEY_EXHAUSTED) {
    return "unconfigured";
  }
  const e = error as Error & { status?: number };
  const message = getErrorMessage(error).toLowerCase();
  if (e?.status === 402) return "quota";
  const quotaPhrases = [
    "out of credits",
    "insufficient credits",
    "insufficient balance",
    "credit limit",
    "no credits",
    "zero balance",
    "billing limit",
    "quota",
  ];
  if (quotaPhrases.some((p) => message.includes(p))) return "quota";
  return "provider";
}

/**
 * User-friendly error copy. Raw provider messages, request ids, and token
 * counts are never shown — the user only needs to know what to do next.
 */
function friendlyChatError(error: unknown): string {
  switch (errorClass(error)) {
    case "quota":
      return "The AI service is out of credits right now. Please top up credits or try again later.";
    case "unconfigured":
      return "The AI service isn't available right now. Please try again later.";
    default:
      return "We couldn't answer that right now. Please try again in a moment.";
  }
}

type ChatTurn = {
  role?: unknown;
  content?: unknown;
};

type Body = {
  message?: unknown;
  originalMessage?: unknown;
  analysis?: Partial<AnalysisResult> | null;
  history?: ChatTurn[] | null;
};

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId =
    req.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const userId = await getCurrentUserId();

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* handled below */
  }

  const question =
    typeof body.message === "string" ? body.message.trim() : "";
  const originalMessage =
    typeof body.originalMessage === "string" ? body.originalMessage : "";
  const analysis = (body.analysis ?? {}) as Record<string, unknown>;

  const history: ChatHistoryMessage[] = (body.history ?? [])
    .filter(
      (turn): turn is ChatHistoryMessage =>
        turn !== null &&
        typeof turn === "object" &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.length > 0
    )
    .slice(-20); // bound history so the context stays small

  if (!question) {
    return new Response(JSON.stringify({ error: "Message is empty." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const limits = await limitsForUser(userId);
  if (question.length > limits.maxMessageChars) {
    return new Response(
      JSON.stringify({
        error: `Message must be at most ${limits.maxMessageChars} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const rl = rateLimit(
    userId ? `user:${userId}` : getClientIp(req),
    userId ? 30 : 15
  );
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Try again in a minute." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Per-user daily quota (anonymous users are gated by the IP rate limit).
  if (userId) {
    const allowed = await tryIncrement(
      userId,
      "chat_messages",
      limits.chatMessagesPerDay
    );
    if (!allowed) return limitReached("chat_messages");
  }

  logRequest(requestId, "analysis/chat", {
    chars: question.length,
    turns: history.length,
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

      let failure: "quota" | "unconfigured" | "provider" | null = null;

      try {
        const messages = buildChatMessages({
          message: originalMessage,
          analysis,
          history,
          question,
        });

        const { content } = await aiClient.streamText(messages, (acc) => {
          send({ type: "text", text: acc });
        }, { maxTokens: 800 });

        const text = content.trim();
        if (!text) throw new Error("Empty answer from AI provider");
        send({ type: "done", text, method: "ai" });
      } catch (error) {
        // Never leak raw provider errors / request ids to the client. The
        // user gets a friendly, actionable message instead; the failure class
        // is recorded server-side for diagnostics.
        failure = errorClass(error);
        send({ type: "error", message: friendlyChatError(error) });
      } finally {
        clearInterval(heartbeat);
        logRequest(requestId, "analysis/chat", {
          chars: question.length,
          latencyMs: Date.now() - startedAt,
          ...(failure ? { error: failure } : {}),
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
