import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/session";
import {
  createUser,
  findUserByEmail,
  setUserVerified,
} from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/cookies";
import { isMailgunConfigured } from "@/lib/mailgun";
import { issueVerificationEmail as sendVerification } from "@/lib/auth/verify";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getClientIp } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthBody = { email?: unknown; password?: unknown };

function parseBody(body: AuthBody): { email: string; password: string } | null {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return null;
  if (!EMAIL_RE.test(email)) return null;
  if (password.length < 8) return null;
  return { email, password };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("register", ip), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as AuthBody;
    const parsed = parseBody(body);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Enter a valid email and a password of at least 8 characters.",
        },
        { status: 400 }
      );
    }
    const email = parsed.email.toLowerCase();

    const existing = await findUserByEmail(email);
    if (existing) {
      logAuthEvent("register", { ip, email, outcome: "duplicate" });
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const user = await createUser(email, hashPassword(parsed.password));

    // Dev convenience: when Mailgun isn't configured (local dev), auto-verify so
    // the existing "register -> signed in" flow still works. Production always
    // requires email verification.
    if (!isMailgunConfigured()) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Registration is temporarily unavailable. Try again later." },
          { status: 503 }
        );
      }
      await setUserVerified(user.id, Date.now());
      setSessionCookie({ id: user.id, email: user.email });
      logAuthEvent("register", {
        ip,
        email,
        outcome: "created_auto_verified_dev",
      });
      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            emailVerified: true,
          },
          requiresVerification: false,
        },
        { status: 201 }
      );
    }

    const result = await sendVerification(user.id, user.email);
    logAuthEvent("register", {
      ip,
      email,
      outcome: result.ok ? "created_pending_verification" : "created_mail_failed",
      sent: result.sent,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Account created, but we could not send the verification email. " +
            "Please try resending from the sign-in page.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          emailVerified: false,
        },
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
