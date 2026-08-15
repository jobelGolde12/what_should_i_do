import { NextResponse } from "next/server";
import { verifyResetToken } from "@/lib/auth/verify";
import { setNewPassword } from "@/lib/auth/users";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/auth/session";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getClientIp } from "@/lib/rateLimit";
import { logAuthEvent, maskEmail } from "@/lib/log";

export const runtime = "nodejs";

type ResetBody = { token?: unknown; password?: unknown };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimitDb(rlKey("reset", ip), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as ResetBody;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) {
      return NextResponse.json(
        { error: "Reset token is required." },
        { status: 400 }
      );
    }

    if (
      !password ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const payload = await verifyResetToken(token);
    if (!payload) {
      logAuthEvent("reset_password", { ip, outcome: "invalid_or_expired" });
      return NextResponse.json(
        { error: "Invalid or expired password reset token." },
        { status: 400 }
      );
    }

    await setNewPassword(payload.userId, hashPassword(password));
    logAuthEvent("reset_password", {
      ip,
      userId: payload.userId,
      emailHash: maskEmail(payload.email),
      outcome: "success",
    });

    return NextResponse.json({
      ok: true,
      message: "Password reset successful. You can now sign in with your new password.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
