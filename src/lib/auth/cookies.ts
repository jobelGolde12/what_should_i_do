import { cookies } from "next/headers";
import { signSession, verifySession } from "./session";
import type { StoredUser } from "./users";
import { findUserById } from "./users";

const COOKIE_NAME = "taskmind_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function setSessionCookie(user: { id: string; email: string }): void {
  cookies().set(COOKIE_NAME, signSession({ sub: user.id, email: user.email }), {
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

/** Reads + verifies the session cookie and loads the user from the DB
 * (Turso-backed, so sessions are valid across instances). Resolves `null`
 * for anonymous / invalid sessions. */
export async function getCurrentUser(): Promise<StoredUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user) return null;
  if (user.email !== payload.email) return null;
  return user;
}

/** Returns the authenticated user's id (or null) without loading synced data. */
export async function getCurrentUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  return payload.sub;
}

export { COOKIE_NAME };
