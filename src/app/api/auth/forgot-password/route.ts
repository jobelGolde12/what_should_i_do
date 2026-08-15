import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/users";
import { issuePasswordResetEmail } from "@/lib/auth/verify";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getClientIp } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ForgotBody = { email?: unknown };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("forgot", ip), 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as ForgotBody;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // Per-account throttle so reset spam can't be spread across many IPs.
    const rlAccount = await rateLimitDb(rlKey("forgot-account", email), 5);
    if (!rlAccount.allowed) {
      logAuthEvent("forgot_password", { ip, email, outcome: "rate_limited" });
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    // Generic response to protect user privacy / avoid enumeration
    if (!user) {
      logAuthEvent("forgot_password", { ip, email, outcome: "not_found" });
      return NextResponse.json({
        ok: true,
        message: "If an account with that email exists, we sent a password reset link.",
      });
    }

    const result = await issuePasswordResetEmail(user.id, user.email);
    logAuthEvent("forgot_password", {
      ip,
      email: user.email,
      userId: user.id,
      outcome: result.ok ? "sent" : "failed",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not send password reset email. Try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "If an account with that email exists, we sent a password reset link.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
