import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/users";
import { issueVerificationEmail } from "@/lib/auth/verify";
import { getCurrentUser } from "@/lib/auth/cookies";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getClientIp } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResendBody = { email?: unknown };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("resend", ip), 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    let email = "";
    try {
      const body = (await request.json()) as ResendBody;
      if (typeof body.email === "string") {
        email = body.email.trim().toLowerCase();
      }
    } catch {
      /* ignore JSON parse errors if logged-in fallback works */
    }

    if (!email) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        email = currentUser.email;
      }
    }

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Valid email address is required." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    // Generic response to avoid email enumeration
    if (!user || user.verified) {
      logAuthEvent("resend_verification", { ip, email, outcome: user ? "already_verified" : "user_not_found" });
      return NextResponse.json({
        ok: true,
        message: "If an unverified account exists, a verification link has been sent.",
      });
    }

    const result = await issueVerificationEmail(user.id, user.email);
    logAuthEvent("resend_verification", {
      ip,
      email: user.email,
      userId: user.id,
      outcome: result.ok ? "sent" : "failed",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not send verification email. Try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Verification email sent.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
