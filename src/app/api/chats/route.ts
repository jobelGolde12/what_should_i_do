import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import {
  deleteChatTopicsByRecord,
  getChatTopicsByRecord,
  MAX_CHAT_MESSAGES,
  upsertChatTopic,
} from "@/lib/auth/users";
import { logRequest } from "@/lib/log";
import type { ChatTopic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_BODY = 512_000;

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}

/** Loose validation before persisting a client-sent chat topic. */
function parseTopic(value: unknown): ChatTopic | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Record<string, unknown>;
  const id = safeId(t.id);
  const recordId = safeId(t.recordId);
  if (!id || !recordId) return null;
  if (typeof t.createdAt !== "number" || !Number.isFinite(t.createdAt)) return null;

  const messages: ChatTopic["messages"] = [];
  if (Array.isArray(t.messages)) {
    for (const m of t.messages.slice(-MAX_CHAT_MESSAGES)) {
      const turn = m as Record<string, unknown>;
      if (
        turn &&
        typeof turn === "object" &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string"
      ) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }

  const context = (t.context ?? {}) as Record<string, unknown>;

  return {
    id,
    recordId,
    ...(typeof t.title === "string" ? { title: t.title.slice(0, 120) } : {}),
    createdAt: t.createdAt,
    updatedAt:
      typeof t.updatedAt === "number" && Number.isFinite(t.updatedAt)
        ? t.updatedAt
        : Date.now(),
    context: {
      input: typeof context.input === "string" ? context.input : "",
      analysis:
        context.analysis && typeof context.analysis === "object"
          ? (context.analysis as ChatTopic["context"]["analysis"])
          : ({} as ChatTopic["context"]["analysis"]),
    },
    messages,
  };
}

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(req.url);
  const recordId = safeId(url.searchParams.get("recordId"));
  if (!recordId) {
    return NextResponse.json(
      { error: "recordId is required." },
      { status: 400 }
    );
  }

  try {
    const topics = await getChatTopicsByRecord(userId, recordId);
    logRequest(url.searchParams.get("x-request-id") ?? "chats", "chats:get", {
      recordId,
      count: topics.length,
    });
    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json(
      { error: "Couldn't load chats." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { topic?: unknown };
  try {
    body = (await req.json()) as { topic?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (JSON.stringify(body).length > MAX_CHAT_BODY) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const topic = parseTopic(body.topic);
  if (!topic) {
    return NextResponse.json({ error: "Invalid chat topic." }, { status: 400 });
  }

  try {
    await upsertChatTopic(userId, topic);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't save chat." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(req.url);
  const recordId = safeId(url.searchParams.get("recordId"));
  if (!recordId) {
    return NextResponse.json(
      { error: "recordId is required." },
      { status: 400 }
    );
  }

  try {
    await deleteChatTopicsByRecord(userId, recordId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't delete chats." },
      { status: 500 }
    );
  }
}
