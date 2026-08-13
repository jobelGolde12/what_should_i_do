import { NextResponse } from "next/server";
import { cronAuthorized, cronUnauthorized, isDryRun } from "@/lib/cron";
import { getSettings } from "@/lib/auth/users";
import { findUserById } from "@/lib/auth/users";
import {
  digestForUser,
  isDigestDue,
  normalizeDigestSettings,
  proUserIdsForDigest,
  recordDigestSent,
} from "@/lib/digest";
import { sendMail } from "@/lib/mailgun";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly digest dispatcher. Run daily via Vercel Cron with
 * `Authorization: Bearer $CRON_SECRET`; it sends to each Pro user whose chosen
 * weekday + hour has just arrived in their own timezone, deduped per week.
 * `?dry=1` reports what WOULD be sent without sending or recording.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return cronUnauthorized();
  const url = new URL(request.url);
  const dry = isDryRun(url);
  // `?now=<ms>` lets schedulers/tests simulate a wall-clock time (still gated
  // by CRON_SECRET) so the per-user day/hour check is deterministic.
  const nowParam = Number(url.searchParams.get("now") || "");
  const now =
    Number.isFinite(nowParam) && nowParam > 0 ? nowParam : Date.now();

  const userIds = await proUserIdsForDigest();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const settings = normalizeDigestSettings(await getSettings(userId));
    if (!isDigestDue(settings, now)) {
      skipped += 1;
      continue;
    }
    const payload = await digestForUser(userId, now);
    if (!payload) {
      skipped += 1;
      continue;
    }
    if (dry) {
      skipped += 1;
      continue;
    }
    const user = await findUserById(userId);
    if (!user) {
      skipped += 1;
      continue;
    }
    const result = await sendMail(user.email, payload.subject, payload.text, payload.html);
    if (result.ok) {
      await recordDigestSent(userId, now);
      sent += 1;
    } else {
      failed += 1;
      logWarn("digest", { userId, error: result.error });
    }
  }

  logInfo("digest", { dry, due: userIds.length, sent, failed, skipped });
  return NextResponse.json({
    ok: true,
    dry,
    users: userIds.length,
    sent,
    failed,
    skipped,
  });
}
