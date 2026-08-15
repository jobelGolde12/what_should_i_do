import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { getInboxByAnalysisId } from "@/lib/inbox";
import { isMailgunConfigured } from "@/lib/mailgun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reply context for a result page: whether a Send button can appear (an inbox
 * row exists for the analysis AND Mailgun sending is configured) plus the To
 * address and subject line to prefill.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const url = new URL(request.url);
  const analysisId = url.searchParams.get("analysisId");
  if (!analysisId) {
    return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  }

  const inbox = await getInboxByAnalysisId(userId, analysisId);
  if (!inbox) {
    return NextResponse.json({ available: false });
  }

  if (!isMailgunConfigured()) {
    return NextResponse.json({ available: false, connected: false });
  }

  return NextResponse.json({
    available: true,
    connected: true,
    provider: "mailgun",
    to: inbox.sender,
    subject: `Re: ${inbox.subject}`,
  });
}
