// Fixed-window per-IP rate limiting, shared by public endpoints.
// Per-process (in-memory) by design: resets on restart, which is fine for
// abuse/DoS protection at this scale. Deploy behind a reverse proxy/edge for
// stricter, distributed limiting.

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** Returns whether the request is allowed and the remaining quota. */
export function rateLimit(
  ip: string,
  limit: number,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  let entry = buckets.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    buckets.set(ip, entry);
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}
