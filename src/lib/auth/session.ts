import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString("hex");
    return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, hash].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  });
  return timingSafeEqual(actual, expected);
}

/** Returns the HMAC signing secret as a Buffer. In production this throws if
 * `AUTH_SECRET` is unset (fail-fast for forgeable sessions/tokens); in dev/test
 * it falls back to a random ephemeral secret (regenerated each process start)
 * with a warning — never a hardcoded value that could be used to forge tokens. */
let devSecret: Buffer | null = null;

export function getSessionSecret(): Buffer {
  const value = process.env.AUTH_SECRET;
  if (value) return Buffer.from(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[auth] AUTH_SECRET is required in production. Set a long random secret."
    );
  }
  if (!devSecret) {
    devSecret = randomBytes(32);
    console.warn(
      "[auth] AUTH_SECRET is not set — using a random ephemeral dev secret. Set AUTH_SECRET in production."
    );
  }
  return devSecret;
}

/** Fail-fast guard: throws in production when `AUTH_SECRET` is missing. */
export function requireAuthSecret(): void {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    throw new Error(
      "[auth] AUTH_SECRET is required in production. Set a long random secret."
    );
  }
}

type SessionPayload = { sub: string; email: string; exp: number };

export function signSession(payload: {
  sub: string;
  email: string;
}): string {
  const body: SessionPayload = {
    sub: payload.sub,
    email: payload.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const bodyB64 = Buffer.from(JSON.stringify(body))
    .toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(bodyB64)
    .digest("base64url");
  return `${bodyB64}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bodyB64, signature] = parts;
  const expected = createHmac("sha256", getSessionSecret())
    .update(bodyB64)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.sub || !payload.email || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
