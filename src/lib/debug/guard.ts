/** Production-safe gating for debug endpoints. */

export function isDebugAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.ADMIN_TOKEN);
}

export function authorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = request.headers.get("authorization");
  const token = process.env.ADMIN_TOKEN ?? "";
  return auth === `Bearer ${token}`;
}

export const DEBUG_UNAVAILABLE = {
  error: "Debug endpoints are disabled in production.",
} as const;
