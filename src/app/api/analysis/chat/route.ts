import { buildChatMessages, type ChatHistoryMessage } from "@/lib/prompts";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { logRequest } from "@/lib/log";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { limitsForUser, planForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached } from "@/lib/pro/usage";
import {
  streamChatCompletion,
  ChatCancelledError,
  ChatProviderError,
  type ChatErrorKind,
} from "@/lib/chat/provider";
import { isAiMockEnabled, mockStreamText } from "@/lib/ai-mock";
import type { AnalysisResult } from "@/app/actions/analyzeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chat Mode endpoint — grounded Q&A over one analysis.
 *
 * Provider architecture (deliberately isolated from the analysis cascade):
 *
 *   Chat UI → this route → src/lib/chat/provider.ts → OpenRouter API
 *                                              └→ OPENROUTER_CHAT_MODEL
 *                                                 (default: openrouter/free,
 *                                                  the Free Models Router)
 *
 * TokenRouter / Zen are NOT consulted here: Chat Mode must never silently
 * fall back to another provider. See docs/chat-openrouter.md.
 */

const MAX_BODY_BYTES = 256 * 1024;
const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CHARS = 4_000;

function encodeSSE(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * User-friendly error copy keyed by normalized provider failure class.
 * Raw provider messages, request ids, env var names, and token counts are
 * never shown — the user only learns what to do next.
 */
function friendlyChatError(kind: ChatErrorKind): string {
  switch (kind) {
    case "unconfigured":
      return "Chat service is not configured. Please contact support if this persists.";
    case "auth":
      return "The AI service could not authenticate the request. Please try again later.";
    case "quota":
      return "The AI service is out of credits right now. Please try again later.";
    case "rate-limit":
      return "The free AI service has reached its current usage limit. Please try again later.";
    case "timeout":
      return "The request took too long to complete. Please try again.";
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

/** Server-side re-validation of client-supplied conversation history. */
function sanitizeHistory(raw: ChatTurn[] | null | undefined): ChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (turn): turn is ChatHistoryMessage =>
        turn !== null &&
        typeof turn === "object" &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_HISTORY_CHARS),
    }));
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId =
    req.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const userId = await getCurrentUserId();

  // Reject oversized payloads before parsing them.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Request too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* handled below by the empty-message check */
  }

  const question =
    typeof body.message === "string" ? body.message.trim() : "";
  const originalMessage =
    typeof body.originalMessage === "string"
      ? body.originalMessage.slice(0, MAX_HISTORY_CHARS)
      : "";
  // The analysis object is client-supplied context — accept only plain objects.
  const analysis = (
    body.analysis && typeof body.analysis === "object" ? body.analysis : {}
  ) as Record<string, unknown>;
  const history = sanitizeHistory(body.history);

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
      let closed = false;
      // Enqueueing after a client disconnect throws — degrade silently.
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSSE(obj));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => {
        try {
          send({ type: "ping" });
        } catch {
          clearInterval(heartbeat);
        }
      }, 10_000);

      // Abort the upstream provider fetch when the client disconnects.
      const onClientAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", onClientAbort, { once: true });

      let failure: ChatErrorKind | "cancelled" | null = null;
      let actualModel: string | undefined;

      try {
        const messages = buildChatMessages({
          message: originalMessage,
          analysis,
          history,
          question,
        });

        let content: string;

        if (isAiMockEnabled()) {
          // Dev-only offline mode (AI_MOCK=1, never in production).
          const mock = await mockStreamText(messages, (acc) =>
            send({ type: "text", text: acc })
          );
          content = mock.content;
        } else {
          const result = await streamChatCompletion(
            messages,
            (acc) => send({ type: "text", text: acc }),
            { signal: req.signal }
          );
          content = result.content;
          actualModel = result.actualModel;
        }

        const text = content.trim();
        if (!text) throw new Error("Empty answer from AI provider");
        send({ type: "done", text, method: "ai" });
      } catch (error) {
        if (error instanceof ChatCancelledError || req.signal.aborted) {
          failure = "cancelled";
        } else {
          const kind =
            error instanceof ChatProviderError ? error.kind : "provider";
          failure = kind;
          // Never leak raw provider errors / request ids to the client —
          // the user gets friendly, actionable copy instead.
          send({ type: "error", message: friendlyChatError(kind) });
        }
      } finally {
        clearInterval(heartbeat);
        req.signal.removeEventListener("abort", onClientAbort);
        logRequest(requestId, "analysis/chat", {
          chars: question.length,
          latencyMs: Date.now() - startedAt,
          provider: "openrouter",
          model: process.env.OPENROUTER_CHAT_MODEL?.trim() || "openrouter/free",
          actualModel,
          ...(failure ? { error: failure } : {}),
        });
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by a client disconnect */
        }
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
