import { NextResponse } from "next/server";
import { cronAuthorized, cronUnauthorized, isDryRun } from "@/lib/cron";
import {
  buildReminderEmail,
  dueReminders,
  markReminderSent,
} from "@/lib/reminders";
import { sendMail } from "@/lib/mailgun";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron sweep for deadline reminder emails. Run every few minutes via Vercel
 * Cron (or any scheduler) with `Authorization: Bearer $CRON_SECRET`.
 * `?dry=1` reports what WOULD be sent without sending or mutating rows.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return cronUnauthorized();
  const dry = isDryRun(new URL(request.url));
  const now = Date.now();

  const due = await dueReminders(now);
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    if (dry) continue;
    const mail = buildReminderEmail(reminder);
    const result = await sendMail(reminder.email, mail.subject, mail.text, mail.html);
    if (result.ok) {
      await markReminderSent(reminder.id);
      sent += 1;
    } else {
      failed += 1;
      logWarn("reminders", {
        reminderId: reminder.id,
        error: result.error,
      });
    }
  }

  logInfo("reminders", { dry, due: due.length, sent, failed });
  return NextResponse.json({
    ok: true,
    dry,
    due: due.length,
    sent,
    failed,
  });
}
