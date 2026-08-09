import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/cookies";
import { getClientIp } from "@/lib/rateLimit";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { logAuthEvent } from "@/lib/log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthBody = { email?: unknown; password?: unknown };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("login", ip), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as AuthBody;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      logAuthEvent("login", { ip, email, outcome: "invalid_credentials" });
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    if (!user.verified) {
      logAuthEvent("login_blocked", { ip, email, userId: user.id, reason: "unverified" });
      return NextResponse.json(
        {
          error: "Please verify your email address before signing in.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    setSessionCookie({ id: user.id, email: user.email });
    logAuthEvent("login", { ip, email: user.email, userId: user.id, outcome: "success" });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        emailVerified: true,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
