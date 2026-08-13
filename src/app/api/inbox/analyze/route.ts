import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { analyzeEmail } from "@/lib/inbound";
import {
  fetchProviderMessage,
  getIntegration,
  isIntegrationProvider,
} from "@/lib/integrations";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Analyzes a message from a connected Gmail/Outlook account. */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  let body: { provider?: unknown; messageId?: unknown };
  try {
    body = (await request.json()) as { provider?: unknown; messageId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const provider = body.provider;
  const messageId = body.messageId;
  if (typeof provider !== "string" || !isIntegrationProvider(provider)) {
    return NextResponse.json(
      { error: "A valid provider is required." },
      { status: 400 }
    );
  }
  if (typeof messageId !== "string" || messageId.trim().length === 0) {
    return NextResponse.json(
      { error: "messageId is required." },
      { status: 400 }
    );
  }

  const integration = await getIntegration(userId, provider);
  if (!integration) {
    return NextResponse.json(
      { error: "This account isn't connected." },
      { status: 409 }
    );
  }

  const msg = await fetchProviderMessage(integration, messageId);
  if (!msg) {
    return NextResponse.json(
      { error: "Couldn't fetch that message." },
      { status: 502 }
    );
  }

  const record = await analyzeEmail(
    userId,
    {
      sender: msg.sender,
      subject: msg.subject,
      body: msg.body,
      externalId: msg.id,
    },
    { provider, receivedAt: msg.receivedAt }
  );
  if (!record) {
    return NextResponse.json(
      { error: "Couldn't analyze that message." },
      { status: 422 }
    );
  }

  logInfo("inbox", { event: "analyzed", userId, provider, analysisId: record.id });
  return NextResponse.json({ ok: true, analysisId: record.id });
}
