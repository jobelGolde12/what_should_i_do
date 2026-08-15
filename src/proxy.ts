/**
 * Global CSRF / cross-origin protection for state-changing requests.
 *
 * SameSite=Lax already blocks the classic cross-site POST cookie-forgery, but
 * this adds an Origin check as a defense-in-depth layer (subdomain-borne
 * requests, Lax top-level navigations that trigger mutations, and future
 * cross-origin embeds). Server-to-server callers (Stripe/Mailgun webhooks,
 * cron, curl) don't send an `Origin` header and pass through.
 *
 * Extra same-origin domains can be allow-listed via `CSRF_ALLOWED_ORIGINS`
 * (comma-separated hostnames).
 */
import { NextRequest, NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ALLOWED_ORIGINS = new Set(
  (process.env.CSRF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean)
);

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (webhooks, cron, curl) don't send Origin — allow.
    return NextResponse.next();
  }

  const givenHost = originHost(origin);
  const host = request.headers.get("host")?.toLowerCase();
  if (givenHost && (givenHost === host || ALLOWED_ORIGINS.has(givenHost))) {
    return NextResponse.next();
  }

  return new NextResponse(
    JSON.stringify({ error: "Cross-origin request blocked." }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
