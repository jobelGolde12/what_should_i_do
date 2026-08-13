import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { proGate, limitsForUser, planForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached } from "@/lib/pro/usage";
import { analyzeBatchTexts } from "@/lib/batchAnalyze";
import { logRequest } from "@/lib/log";
import type { AnalysisResult } from "@/app/actions/analyzeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(user.id);
  if (denied) return denied;

  let texts: string[] = [];
  try {
    const body = (await request.json()) as { texts?: unknown };
    if (Array.isArray(body.texts)) {
      texts = body.texts
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  } catch {
    /* handled below */
  }

  if (texts.length === 0) {
    return NextResponse.json({ error: "No messages to analyze." }, { status: 400 });
  }

  const limits = await limitsForUser(user.id);
  if (texts.length > limits.batchSize) {
    return NextResponse.json(
      { error: `Batch is limited to ${limits.batchSize} messages at a time.` },
      { status: 413 }
    );
  }
  const overlong = texts.find((t) => t.length > limits.maxMessageChars);
  if (overlong) {
    return NextResponse.json(
      { error: `Each message must be at most ${limits.maxMessageChars} characters.` },
      { status: 413 }
    );
  }

  const rl = rateLimit(getClientIp(request), user.id ? 30 : 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many batch requests. Try again in a minute." },
      { status: 429 }
    );
  }

  // Meter per message so a large batch cannot bypass the daily quota.
  for (let i = 0; i < texts.length; i++) {
    const allowed = await tryIncrement(user.id, "analyses", limits.analysesPerDay);
    if (!allowed) return limitReached("analyses");
  }

  const startedAt = Date.now();
  const requestId =
    request.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  logRequest(requestId, "analyze/batch", {
    count: texts.length,
    plan: await planForUser(user.id),
  });

  try {
    const outputs = await analyzeBatchTexts(texts);
    const results: { text: string; output: AnalysisResult }[] = texts.map(
      (text, index) => ({ text, output: outputs[index] })
    );
    logRequest(requestId, "analyze/batch", {
      count: texts.length,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch analysis failed.";
    logRequest(requestId, "analyze/batch", {
      count: texts.length,
      error: message,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
