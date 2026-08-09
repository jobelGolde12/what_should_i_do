/**
 * Shared (DB-backed) fixed-window rate limiter.
 *
 * Unlike the in-memory limiter in `rateLimit.ts`, this stores counters in Turso
 * so limits hold across multiple server instances behind a load balancer. It is
 * used for auth endpoints (register, login, verification, password reset).
 *
 * Window key is a composite of the action + IP (or email) so each action has
 * its own bucket. Counters roll over naturally at the window boundary.
 */
import { getDb, ensureSchema } from "@/lib/db";
import { logWarn } from "@/lib/log";
import type { RateLimitResult } from "@/lib/rateLimit";

/**
 * Fixed-window counter. `key` is the full bucket key (caller includes the
 * action + IP/email). Returns the decision + remaining quota for this request.
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs = 60_000
): Promise<RateLimitResult> {
  await ensureSchema();
  const now = Date.now();
  const windowStart = now - (now % windowMs);

  try {
    const db = getDb();
    // Atomically increment (insert-if-absent) within the window. On Turso the
    // upsert + read are separate round-trips; an over-count of 1 under extreme
    // concurrency is acceptable for abuse shielding.
    await db.execute(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1",
      [key, windowStart]
    );
    const res = await db.execute(
      "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
      [key, windowStart]
    );
    const count = res.rows?.length ? Number(res.rows[0].count) : 1;
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: windowStart + windowMs,
    };
  } catch (err) {
    logWarn("rate-limit", {
      error: err instanceof Error ? err.message : "db unavailable",
      key,
    });
    // Fail closed when the DB is unreachable: don't allow unlimited abuse.
    return { allowed: false, remaining: 0, resetAt: now + windowMs };
  }
}

/** Prune windows older than 24 windows (bounded table growth). */
export async function pruneRateLimits(windowMs = 60_000): Promise<void> {
  const now = Date.now();
  const cutoff = now - windowMs * 24;
  try {
    const db = getDb();
    await db.execute("DELETE FROM rate_limits WHERE window_start < ?", [cutoff]);
  } catch (err) {
    logWarn("rate-limit", {
      error: err instanceof Error ? err.message : "prune failed",
    });
  }
}

/** Bucket key helper: `action:ip` so each action is rate-limited separately. */
export function rlKey(action: string, ip: string): string {
  return `${action}:${ip}`;
}
