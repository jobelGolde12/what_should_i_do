import { cookies } from "next/headers";
import { signSession, verifySession } from "./session";
import type { StoredUser } from "./users";
import { findUserById } from "./users";

const COOKIE_NAME = "taskmind_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function setSessionCookie(user: {
  id: string;
  email: string;
}): void {
  cookies().set(
    COOKIE_NAME,
    signSession({ sub: user.id, email: user.email }),
    {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getCurrentUser(): StoredUser | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = findUserById(payload.sub);
  if (!user) return null;
  if (user.email !== payload.email) return null;
  return user;
}

export { COOKIE_NAME };
