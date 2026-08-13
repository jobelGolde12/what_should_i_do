import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { getSettings, upsertSetting } from "@/lib/auth/users";
import { DEFAULT_REMINDER_PRESET, REMINDER_PRESETS } from "@/lib/reminderPresets";
import {
  DIGEST_DAY_KEY,
  DIGEST_ENABLED_KEY,
  DIGEST_HOUR_KEY,
  DIGEST_TIMEZONE_KEY,
  normalizeDigestSettings,
} from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDERS_ENABLED_KEY = "reminders.enabled";
const REMINDERS_PRESET_KEY = "reminders.preset";

/** Returns the saved "Reminders & digest" preferences. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const settings = await getSettings(userId);
  const remindersEnabled = settings[REMINDERS_ENABLED_KEY];
  const preset = settings[REMINDERS_PRESET_KEY];

  return NextResponse.json({
    reminders: {
      enabled:
        typeof remindersEnabled === "boolean" ? remindersEnabled : true,
      preset:
        typeof preset === "string" && preset.length > 0
          ? preset
          : DEFAULT_REMINDER_PRESET,
    },
    digest: normalizeDigestSettings(settings),
  });
}

/** Saves the "Reminders & digest" preferences from Settings. */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  let body: { reminders?: unknown; digest?: unknown };
  try {
    body = (await request.json()) as { reminders?: unknown; digest?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const reminders = (body.reminders ?? {}) as Record<string, unknown>;
  const digest = (body.digest ?? {}) as Record<string, unknown>;

  if (typeof reminders.enabled === "boolean") {
    await upsertSetting(userId, REMINDERS_ENABLED_KEY, reminders.enabled);
  }
  if (typeof reminders.preset === "string") {
    const preset = reminders.preset;
    const valid =
      preset === "custom" || REMINDER_PRESETS.some((p) => p.key === preset);
    if (!valid) {
      return NextResponse.json(
        { error: "Unknown reminder preset." },
        { status: 400 }
      );
    }
    await upsertSetting(userId, REMINDERS_PRESET_KEY, preset);
  }

  if (typeof digest.enabled === "boolean") {
    await upsertSetting(userId, DIGEST_ENABLED_KEY, digest.enabled);
  }
  if (typeof digest.day === "number") {
    if (!Number.isInteger(digest.day) || digest.day < 0 || digest.day > 6) {
      return NextResponse.json(
        { error: "digest.day must be an integer 0–6." },
        { status: 400 }
      );
    }
    await upsertSetting(userId, DIGEST_DAY_KEY, digest.day);
  }
  if (typeof digest.hour === "number") {
    if (!Number.isInteger(digest.hour) || digest.hour < 0 || digest.hour > 23) {
      return NextResponse.json(
        { error: "digest.hour must be an integer 0–23." },
        { status: 400 }
      );
    }
    await upsertSetting(userId, DIGEST_HOUR_KEY, digest.hour);
  }
  if (typeof digest.timezone === "string" && digest.timezone.trim().length <= 64) {
    await upsertSetting(userId, DIGEST_TIMEZONE_KEY, digest.timezone.trim());
  }

  return NextResponse.json({ ok: true });
}
