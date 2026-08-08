import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/session";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/cookies";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

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
  const rl = rateLimit(getClientIp(request), 10);
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
        { error: "Enter a valid email and a password of at least 8 characters." },
        { status: 400 }
      );
    }
    const email = parsed.email.toLowerCase();

    if (findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const user = createUser(email, hashPassword(parsed.password));
    setSessionCookie({ id: user.id, email: user.email });

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, createdAt: user.createdAt },
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
