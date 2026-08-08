import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/cookies";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthBody = { email?: unknown; password?: unknown };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, 10);
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

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    setSessionCookie({ id: user.id, email: user.email });
    return NextResponse.json({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
