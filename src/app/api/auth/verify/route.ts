import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth/verify";
import { setSessionCookie } from "@/lib/auth/cookies";
import { logAuthEvent } from "@/lib/log";
import { getClientIp } from "@/lib/rateLimit";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const ip = getClientIp(request);

  const rl = await rateLimitDb(rlKey("verify", ip), 20);
  if (!rl.allowed) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const url = new URL("/auth/verify", request.url);
      url.searchParams.set("error", "rate_limited");
      return NextResponse.redirect(url);
    }
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required." },
      { status: 400 }
    );
  }

  try {
    const payload = await verifyEmailToken(token);
    if (!payload) {
      logAuthEvent("verify_failed", { ip, outcome: "invalid_or_expired" });
      // If request accepts HTML (browser navigation), redirect to verify page with error
      const accept = request.headers.get("accept") || "";
      if (accept.includes("text/html")) {
        const url = new URL("/auth/verify", request.url);
        url.searchParams.set("error", "invalid_or_expired");
        return NextResponse.redirect(url);
      }
      return NextResponse.json(
        { error: "Invalid or expired verification token." },
        { status: 400 }
      );
    }

    setSessionCookie({ id: payload.userId, email: payload.email });
    logAuthEvent("verify", { ip, userId: payload.userId, email: payload.email });

    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const url = new URL("/auth/verify", request.url);
      url.searchParams.set("success", "1");
      return NextResponse.redirect(url);
    }

    return NextResponse.json({
      ok: true,
      message: "Email verified successfully.",
      user: { id: payload.userId, email: payload.email, emailVerified: true },
    });
  } catch {
    return NextResponse.json(
      { error: "Verification failed. Try again." },
      { status: 500 }
    );
  }
}
