import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import {
  activeRemindersForAnalysis,
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_MIN,
  getReminderPlan,
  markReminderPlan,
  presetMs,
  queueRemindersForAnalysis,
  type ReminderRow,
} from "@/lib/reminders";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DEADLINES = 100;
const MAX_DEADLINE_LEN = 500;

function deadlineList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_DEADLINES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    if (item.trim().length === 0 || item.length > MAX_DEADLINE_LEN) return null;
    out.push(item);
  }
  return out;
}

/** GET ?analysisId=… → current calendar plan + active reminders for an analysis. */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const url = new URL(request.url);
  const analysisId = (url.searchParams.get("analysisId") || "").slice(0, 200);
  if (!analysisId) {
    return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  }

  const [plan, reminders] = await Promise.all([
    getReminderPlan(userId, analysisId),
    activeRemindersForAnalysis(userId, analysisId),
  ]);

  return NextResponse.json({
    plan,
    reminders: reminders.map((r) => ({
      id: r.id,
      deadlineText: r.deadlineText,
      dueAt: r.dueAt,
      remindAt: r.remindAt,
    })),
  });
}

type RemindersBody = {
  analysisId?: unknown;
  deadlines?: unknown;
  presetKey?: unknown;
  customMinutes?: unknown;
  markCalendar?: unknown;
};

/** POST → create reminders (+ calendar plan) for the given deadlines. */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  let body: RemindersBody;
  try {
    body = (await request.json()) as RemindersBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const analysisId =
    typeof body.analysisId === "string" ? body.analysisId.trim().slice(0, 200) : "";
  if (!analysisId) {
    return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  }
  const deadlines = deadlineList(body.deadlines);
  if (!deadlines) {
    return NextResponse.json(
      { error: "deadlines must be a list of up to 100 short strings." },
      { status: 400 }
    );
  }
  if (deadlines.length === 0) {
    return NextResponse.json({ error: "No deadlines to act on." }, { status: 400 });
  }

  const markCalendar = body.markCalendar === true;

  let created: ReminderRow[] = [];
  if (!markCalendar) {
    let offsetMs: number;
    if (typeof body.presetKey === "string" && presetMs(body.presetKey) !== null) {
      offsetMs = presetMs(body.presetKey) as number;
    } else if (typeof body.customMinutes === "number") {
      if (
        !Number.isFinite(body.customMinutes) ||
        body.customMinutes < CUSTOM_MINUTES_MIN ||
        body.customMinutes > CUSTOM_MINUTES_MAX
      ) {
        return NextResponse.json(
          {
            error: `customMinutes must be between ${CUSTOM_MINUTES_MIN} and ${CUSTOM_MINUTES_MAX}.`,
          },
          { status: 400 }
        );
      }
      offsetMs = Math.round(body.customMinutes) * 60_000;
    } else {
      return NextResponse.json(
        { error: "presetKey or customMinutes is required." },
        { status: 400 }
      );
    }
    created = await queueRemindersForAnalysis(userId, analysisId, deadlines, {
      offsetMs,
    });
  }

  const remindAtByText: Record<string, number> = {};
  for (const reminder of created) {
    remindAtByText[reminder.deadlineText] = reminder.remindAt;
  }

  // Persist the calendar plan so re-opening the analysis doesn't double-add.
  const plan = await markReminderPlan(userId, analysisId, deadlines, {
    remindAt: markCalendar ? null : undefined,
    remindAtByText,
  });

  logInfo("reminders", { userId, analysisId, created: created.length, markCalendar });
  return NextResponse.json({
    ok: true,
    created: created.length,
    plan,
  });
}
