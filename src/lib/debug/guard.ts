/** Production-safe gating for debug endpoints. Debug endpoints are gated by
 * explicit opt-in (`ALLOW_DEBUG=1`) plus an admin bearer token in every
 * environment — dev servers don't get a free pass anymore. */

export function isDebugAllowed(): boolean {
  return process.env.ALLOW_DEBUG === "1" && Boolean(process.env.ADMIN_TOKEN);
}

export function authorized(request: Request): boolean {
  if (!isDebugAllowed()) return false;
  const auth = request.headers.get("authorization");
  const token = process.env.ADMIN_TOKEN ?? "";
  return auth === `Bearer ${token}`;
}

export const DEBUG_UNAVAILABLE = {
  error: "Debug endpoints are disabled.",
} as const;
