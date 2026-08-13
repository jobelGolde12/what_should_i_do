import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import {
  getIntegration,
  isIntegrationProvider,
  listProviderMessages,
} from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists recent messages straight from a connected provider (metadata only —
 * subjects, senders, snippets, dates). The Inbox UI uses this to let the user
 * pick messages to analyze.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const url = new URL(request.url);
  const providerParam = url.searchParams.get("provider");
  if (typeof providerParam !== "string" || !isIntegrationProvider(providerParam)) {
    return NextResponse.json(
      { error: "A valid provider is required." },
      { status: 400 }
    );
  }
  const rawLimit = Number(url.searchParams.get("limit") ?? 10);
  const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10;

  const integration = await getIntegration(userId, providerParam);
  if (!integration) {
    return NextResponse.json(
      { error: "This account isn't connected." },
      { status: 409 }
    );
  }

  const messages = await listProviderMessages(integration, limit);
  return NextResponse.json({ messages });
}
