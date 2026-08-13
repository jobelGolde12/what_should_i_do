import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { getInboxMessages } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMessage(msg: {
  id: string;
  provider: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  analysisId: string;
  analyzed: boolean;
  replied: boolean;
}) {
  return {
    id: msg.id,
    provider: msg.provider,
    sender: msg.sender,
    subject: msg.subject,
    snippet: msg.snippet,
    receivedAt: msg.receivedAt,
    analysisId: msg.analysisId,
    analyzed: msg.analyzed,
    replied: msg.replied,
  };
}

/** Lists stored inbox messages (no bodies — fetched on demand). */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50;

  const messages = await getInboxMessages(userId, limit);
  return NextResponse.json({
    messages: messages.map(publicMessage),
  });
}
