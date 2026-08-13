import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { getInboxByAnalysisId, markInboxReplied } from "@/lib/inbox";
import {
  getIntegration,
  listIntegrations,
  sendProviderMail,
  type IntegrationProvider,
} from "@/lib/integrations";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Sends a reply through the user's connected provider. The two-step confirm
 * lives in the UI — this endpoint never auto-sends: it requires an explicit
 * to/subject/body. Marks the originating inbox message as replied.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  let body: {
    analysisId?: unknown;
    to?: unknown;
    subject?: unknown;
    body?: unknown;
  };
  try {
    body = (await request.json()) as {
      analysisId?: unknown;
      to?: unknown;
      subject?: unknown;
      body?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  const analysisId =
    typeof body.analysisId === "string" ? body.analysisId.trim() : "";

  if (!validEmail(to)) {
    return NextResponse.json({ error: "A valid recipient is required." }, { status: 400 });
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

  const inbox = analysisId
    ? await getInboxByAnalysisId(userId, analysisId)
    : null;
  const connected = await listIntegrations(userId);
  if (connected.length === 0) {
    return NextResponse.json(
      { error: "Connect Gmail or Outlook to send replies." },
      { status: 409 }
    );
  }

  const provider =
    inbox && (inbox.provider === "gmail" || inbox.provider === "outlook")
      ? (inbox.provider as IntegrationProvider)
      : connected[0].provider;

  const integration = await getIntegration(userId, provider);
  if (!integration) {
    return NextResponse.json(
      { error: "That account isn't connected." },
      { status: 409 }
    );
  }

  const result = await sendProviderMail(integration, { to, subject, body: text });
  if (!result.ok) {
    logWarn("inbox", {
      event: "send_failed",
      userId,
      provider,
      error: result.error,
    });
    return NextResponse.json(
      { error: "Couldn't send the reply. Try again." },
      { status: 502 }
    );
  }

  if (inbox) await markInboxReplied(userId, inbox.id);
  logInfo("inbox", { event: "sent", userId, provider, analysisId });
  return NextResponse.json({ ok: true, messageId: result.messageId ?? null });
}
