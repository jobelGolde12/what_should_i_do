/**
 * Shared guard for Vercel Cron / scheduled routes.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; we also accept an
 * explicit `x-cron-secret` header for curl/testing. Without the env var the
 * routes refuse to run (fail closed), so a misconfigured deployment never
 * exposes scheduled work.
 */

export function cronSecret(): string {
  return (process.env.CRON_SECRET || "").trim();
}

/** `true` when the request carries a valid cron secret. */
export function cronAuthorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const x = request.headers.get("x-cron-secret") || "";
  return auth === `Bearer ${secret}` || x === secret;
}

/** Standard 401 response for unauthorised cron callers. */
export function cronUnauthorized(): Response {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

/** `?dry=1` runs the sweep without sending emails or mutating rows. */
export function isDryRun(url: URL): boolean {
  return url.searchParams.get("dry") === "1";
}
