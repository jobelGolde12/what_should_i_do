import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { getInboxByAnalysisId, markInboxReplied } from "@/lib/inbox";
import { isMailgunConfigured, sendMail } from "@/lib/mailgun";
import { rateLimit } from "@/lib/rateLimit";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;
const SEND_LIMIT = 20; // replies per user per minute

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Sends a reply via Mailgun. The recipient is never client-supplied: it is
 * derived from the originating inbox message (`sender`), so this endpoint
 * cannot be used as an open email relay. Requires the analysis id that the
 * inbox message was analyzed into, and is rate-limited per user. Marks the
 * originating inbox message as replied.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const rl = rateLimit(`send:${userId}`, SEND_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many replies. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: {
    analysisId?: unknown;
    subject?: unknown;
    body?: unknown;
  };
  try {
    body = (await request.json()) as {
      analysisId?: unknown;
      subject?: unknown;
      body?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  const analysisId =
    typeof body.analysisId === "string" ? body.analysisId.trim() : "";

  if (!analysisId) {
    return NextResponse.json(
      { error: "An inbox message is required to reply." },
      { status: 400 }
    );
  }
  if (!subject) {
    return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  }
  if (text.length < 1 || text.length > MAX_BODY) {
    return NextResponse.json(
      { error: "The reply body is empty or too large." },
      { status: 400 }
    );
  }

  const inbox = await getInboxByAnalysisId(userId, analysisId);
  if (!inbox) {
    return NextResponse.json(
      { error: "Inbox message not found." },
      { status: 404 }
    );
  }

  const to = inbox.sender.trim();
  if (!validEmail(to)) {
    logWarn("inbox", { event: "invalid_sender", userId, analysisId });
    return NextResponse.json(
      { error: "This inbox message has no valid reply address." },
      { status: 400 }
    );
  }

  if (!isMailgunConfigured()) {
    return NextResponse.json(
      { error: "Email sending isn't configured." },
      { status: 409 }
    );
  }

  const result = await sendMail(to, subject, text);
  if (!result.ok) {
    logWarn("inbox", {
      event: "send_failed",
      userId,
      error: result.error,
    });
    return NextResponse.json(
      { error: "Couldn't send the reply. Try again." },
      { status: 502 }
    );
  }

  await markInboxReplied(userId, inbox.id);
  logInfo("inbox", { event: "sent", userId, analysisId });
  return NextResponse.json({ ok: true, messageId: result.messageId ?? null });
}
