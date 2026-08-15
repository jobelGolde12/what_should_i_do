import { NextResponse } from "next/server";
import { encryptSharePayload } from "@/lib/share-crypto";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getClientIp } from "@/lib/rateLimit";
import { logWarn } from "@/lib/log";
import type { SharePayload } from "@/lib/types";

export const runtime = "nodejs";

const MAX_INPUT_LEN = 20_000;
const MAX_OUTPUT_FIELDS = 200;
const URGENCY_VALUES = ["Urgent", "Important", "Informational"] as const;
const METHOD_VALUES = ["ai", "fallback"] as const;

type ShareBody = { payload?: unknown };

function isStringArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_OUTPUT_FIELDS &&
    v.every((item) => typeof item === "string" && item.length <= 20_000)
  );
}

function validatePayload(raw: unknown): SharePayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid share payload.");
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.timestamp !== "number" || !Number.isFinite(p.timestamp)) {
    throw new Error("Invalid share payload.");
  }
  if (p.timestamp > Date.now() + 60_000) {
    throw new Error("Invalid share payload.");
  }
  if (typeof p.input !== "string" || p.input.length > MAX_INPUT_LEN) {
    throw new Error("Invalid share payload.");
  }
  const o = (p.output ?? {}) as Record<string, unknown>;
  if (!isStringArray(o.actions) || !isStringArray(o.deadlines)) {
    throw new Error("Invalid share payload.");
  }
  if (
    !Array.isArray(o.confusingParts) ||
    o.confusingParts.length > MAX_OUTPUT_FIELDS ||
    o.confusingParts.some(
      (c) => !c || typeof c !== "object" || typeof (c as { sentence?: unknown }).sentence !== "string"
    )
  ) {
    throw new Error("Invalid share payload.");
  }
  if (
    typeof o.urgency !== "string" ||
    !(URGENCY_VALUES as readonly string[]).includes(o.urgency)
  ) {
    throw new Error("Invalid share payload.");
  }
  if (
    typeof o.summary !== "string" ||
    typeof o.nextStep !== "string"
  ) {
    throw new Error("Invalid share payload.");
  }
  if (
    typeof o.analysisMethod !== "string" ||
    !(METHOD_VALUES as readonly string[]).includes(o.analysisMethod)
  ) {
    throw new Error("Invalid share payload.");
  }

  const payload: SharePayload = {
    timestamp: p.timestamp,
    input: p.input,
    output: {
      actions: o.actions as string[],
      deadlines: o.deadlines as string[],
      urgency: o.urgency as SharePayload["output"]["urgency"],
      summary: o.summary as string,
      nextStep: o.nextStep as string,
      confusingParts: o.confusingParts as SharePayload["output"]["confusingParts"],
      analysisMethod: o.analysisMethod as SharePayload["output"]["analysisMethod"],
    },
  };
  if (typeof o.urgencyReason === "string") payload.output.urgencyReason = o.urgencyReason;
  if (typeof o.urgencyConfidence === "number" && Number.isFinite(o.urgencyConfidence)) {
    payload.output.urgencyConfidence = o.urgencyConfidence;
  }
  if (typeof o.nextStepReason === "string") payload.output.nextStepReason = o.nextStepReason;
  if (typeof o.nextStepActionIndex === "number" && Number.isFinite(o.nextStepActionIndex)) {
    payload.output.nextStepActionIndex = o.nextStepActionIndex;
  }
  if (typeof p.includeInput === "boolean") payload.includeInput = p.includeInput;
  if (typeof p.sensitive === "boolean") payload.sensitive = p.sensitive;
  return payload;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("share", ip), 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  let payload: SharePayload;
  try {
    const body = (await request.json().catch(() => ({}))) as ShareBody;
    payload = validatePayload(body.payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid share payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let token: string;
  try {
    token = encryptSharePayload(payload);
  } catch (err) {
    logWarn("share", {
      event: "encrypt_failed",
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Sharing is unavailable right now. Please try again later." },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ link: `${origin}/share/${token}` });
}
