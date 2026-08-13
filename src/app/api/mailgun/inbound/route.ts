import { NextResponse } from "next/server";
import {
  analyzeInboundEmail,
  inboundRateLimited,
  inboundUser,
  isAutoReply,
  isTransactionalSender,
  parseInboundMessage,
  parseMessageHeaders,
  verifyMailgunSignature,
} from "@/lib/inbound";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mailgun inbound route. Set this as the receive route for `*@<inbound domain>`
 * and Mailgun will POST parsed messages here (form-encoded, signature-verified).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const record: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") record[key] = value;
  }

  if (!verifyMailgunSignature(record)) {
    logWarn("inbound", { reason: "bad_signature" });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const msg = parseInboundMessage(record);
  if (!msg.slug) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const user = await inboundUser(msg.slug);
  if (!user) {
    logWarn("inbound", { reason: "unknown_slug", slug: msg.slug });
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (inboundRateLimited(msg.slug)) {
    logWarn("inbound", { reason: "rate_limited", slug: msg.slug });
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // Loop / abuse protection: skip auto-replies and our own transactional mail.
  const headers = parseMessageHeaders(record["message-headers"]);
  if (isAutoReply(headers) || isTransactionalSender(msg.sender)) {
    logInfo("inbound", { slug: msg.slug, skipped: true });
    return NextResponse.json({ ok: true, skipped: true });
  }

  const analysis = await analyzeInboundEmail(user.id, msg);
  if (!analysis) {
    return NextResponse.json({ ok: false, reason: "not_analyzed" }, { status: 422 });
  }

  logInfo("inbound", { slug: msg.slug, userId: user.id, analysisId: analysis.id });
  return NextResponse.json({ ok: true, analysisId: analysis.id });
}
