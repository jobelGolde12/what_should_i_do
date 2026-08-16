/**
 * Per-user usage metering backed by the `pro_usage` table. Fixed windows:
 * `dayWindow()` for analyses/translations/exports, `monthWindow()` for
 * conversions. Mirrors the fixed-window semantics of `src/lib/rateLimit.ts`
 * but is per-user and durable (survives restarts / multiple instances).
 */
import { getDb, ensureSchema } from "@/lib/db";

export type UsageMetric =
  | "analyses"
  | "translations"
  | "conversions"
  | "exports"
  | "reply_drafts"
  | "chat_messages";

export function dayWindow(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function monthWindow(now = Date.now()): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function db() {
  await ensureSchema();
  return getDb();
}

export async function usageCount(
  userId: string,
  metric: UsageMetric,
  window = dayWindow()
): Promise<number> {
  const database = await db();
  const res = await database.execute(
    "SELECT count FROM pro_usage WHERE user_id = ? AND metric = ? AND window_start = ?",
    [userId, metric, window]
  );
  if (!res.rows?.length) return 0;
  return Number(res.rows[0].count ?? 0);
}

/**
 * Increments the counter for a metric in the given window and returns the new
 * count (so callers can compare against the plan limit in one round-trip).
 */
export async function incrementUsage(
  userId: string,
  metric: UsageMetric,
  window = dayWindow()
): Promise<number> {
  const database = await db();
  await database.execute(
    "INSERT INTO pro_usage(user_id, metric, window_start, count) VALUES (?, ?, ?, 1) " +
      "ON CONFLICT(user_id, metric, window_start) DO UPDATE SET count = count + 1",
    [userId, metric, window]
  );
  return usageCount(userId, metric, window);
}

/** Returns true and increments only when the user is under the limit.
 * Atomic: the conditional upsert (`WHERE count < ?`) and the returned
 * rows-affected count make the read-check-increment a single statement, so
 * concurrent requests can't both slip past the cap (SEC-19). */
export async function tryIncrement(
  userId: string,
  metric: UsageMetric,
  limit: number,
  window = dayWindow()
): Promise<boolean> {
  const database = await db();
  const res = await database.execute(
    "INSERT INTO pro_usage(user_id, metric, window_start, count) VALUES (?, ?, ?, 1) " +
      "ON CONFLICT(user_id, metric, window_start) DO UPDATE SET count = count + 1 " +
      "WHERE count < ?",
    [userId, metric, window, limit]
  );
  // rowsAffected is 0 when the DO UPDATE branch ran but its WHERE clause
  // filtered it out (i.e. the user is at/over the limit).
  return Number(res.rowsAffected) > 0;
}

/** Standard "limit reached" JSON response with an upsell-friendly code. */
export function limitReached(metric: UsageMetric): Response {
  return Response.json(
    {
      error: `Daily ${metric} limit reached. Upgrade to TaskMind Pro for higher limits.`,
      code: "LIMIT_REACHED",
      metric,
    },
    { status: 429 }
  );
}
