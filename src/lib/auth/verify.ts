/**
 * Email-verification (and password-reset) token helpers.
 *
 * Tokens are HMAC-SHA256 signed (tamper-evident) AND single-use. Only the
 * SHA-256 hash of the token is stored server-side, so a database leak does not
 * expose usable tokens. The signed token encodes `{ userId, email, exp }`.
 *
 * Token shape:  `<base64url(payload)>.<base64url(hmac)>`
 * Stored hash:  `sha256hex(token)`
 *
 * The signing secret is the same `AUTH_SECRET` used for sessions (see
 * `session.ts`), so a single secret rotates both.
 */
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { getSessionSecret } from "./session";
import { sendMail, isMailgunConfigured, buildAppUrl } from "@/lib/mailgun";
import {
  storeVerificationToken,
  hasVerificationToken,
  consumeVerificationToken,
  setUserVerified,
  storePasswordReset,
  findPasswordReset,
  consumePasswordReset,
} from "./users";
import { logWarn } from "@/lib/log";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export interface SignedTokenPayload {
  userId: string;
  email: string;
  expiresAt: number;
}

export interface SignedToken {
  token: string;
  tokenHash: string;
  expiresAt: number;
}

export interface IssueEmailResult {
  ok: boolean;
  sent: boolean;
  error?: string;
  messageId?: string;
}

/** SHA-256 hex of the token string — what gets persisted / looked up. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Builds `<payloadB64>.<signature>` (does not persist anything). */
export function generateSignedToken(
  userId: string,
  email: string,
  ttlMs: number
): SignedToken {
  const expiresAt = Date.now() + ttlMs;
  const payload = Buffer.from(
    JSON.stringify({ userId, email, expiresAt })
  ).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  const token = `${payload}.${signature}`;
  return { token, tokenHash: hashToken(token), expiresAt };
}

/** Verifies the HMAC signature + expiry. Does NOT check single-use state in DB. */
export function validateSignedToken(
  token: string
): SignedTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expected = createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  )
    return null;

  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as SignedTokenPayload;
  } catch {
    return null;
  }
  if (
    !payload.userId ||
    !payload.email ||
    typeof payload.expiresAt !== "number"
  )
    return null;
  if (Date.now() > payload.expiresAt) return null; // expired
  return payload;
}

export function verificationLink(token: string): string {
  return buildAppUrl(`/auth/verify?token=${encodeURIComponent(token)}`);
}

export function resetLink(token: string): string {
  return buildAppUrl(`/auth/reset-password?token=${encodeURIComponent(token)}`);
}
/* =========================================================
   Email orchestration
   ========================================================= */

/** Generates, persists (as hash), and emails a verification link. */
export async function issueVerificationEmail(
  userId: string,
  email: string
): Promise<IssueEmailResult> {
  const { token, tokenHash, expiresAt } = generateSignedToken(
    userId,
    email,
    VERIFICATION_TTL_MS
  );
  await storeVerificationToken(userId, tokenHash, expiresAt);

  if (!isMailgunConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, sent: false, error: "mailgun_not_configured" };
    }
    // Dev: token is stored but no email is sent. The account stays unverified
    // so production behaviour is still exercised in tests via verifyEmailToken.
    logWarn("auth", {
      event: "verification_not_sent_no_mailgun",
      userId,
    });
    return { ok: true, sent: false };
  }

  const link = verificationLink(token);
  const result = await sendMail(
    email,
    "Verify your email for TaskMind",
    verificationText(email, link),
    verificationHtml(email, link)
  );
  return {
    ok: result.ok,
    sent: result.ok,
    error: result.error,
    messageId: result.messageId,
  };
}

/** Validates a verification token, marks the account verified (single-use). */
export async function verifyEmailToken(
  token: string
): Promise<SignedTokenPayload | null> {
  const payload = validateSignedToken(token);
  if (!payload) return null;
  const tokenHash = hashToken(token);
  if (!(await hasVerificationToken(tokenHash))) return null;
  await consumeVerificationToken(tokenHash);
  await setUserVerified(payload.userId, Date.now());
  return payload;
}

export async function issuePasswordResetEmail(
  userId: string,
  email: string
): Promise<IssueEmailResult> {
  const { token, tokenHash, expiresAt } = generateSignedToken(
    userId,
    email,
    RESET_TTL_MS
  );
  await storePasswordReset(userId, tokenHash, expiresAt);

  if (!isMailgunConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, sent: false, error: "mailgun_not_configured" };
    }
    logWarn("auth", {
      event: "password_reset_not_sent_no_mailgun",
      userId,
    });
    return { ok: true, sent: false };
  }

  const link = resetLink(token);
  const result = await sendMail(
    email,
    "Reset your TaskMind password",
    resetText(email, link),
    resetHtml(email, link)
  );
  return {
    ok: result.ok,
    sent: result.ok,
    error: result.error,
    messageId: result.messageId,
  };
}

/** Validates a reset token and consumes it. Returns the user id or null. */
export async function verifyResetToken(
  token: string
): Promise<SignedTokenPayload | null> {
  const payload = validateSignedToken(token);
  if (!payload) return null;
  const tokenHash = hashToken(token);
  const row = await findPasswordReset(tokenHash);
  if (!row) return null;
  await consumePasswordReset(tokenHash);
  if (Date.now() > row.expiresAt) return null; // expired
  return payload;
}
/* =========================================================
   Email bodies
   ========================================================= */

const APP_NAME = "TaskMind";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function verificationText(email: string, link: string): string {
  return (
    `${APP_NAME} - please verify your email\n\n` +
    `Hi ${email},\n\n` +
    `Thanks for signing up. Click the link below to verify your email and ` +
    `activate your account:\n\n${link}\n\n` +
    `This link expires in 24 hours. If you didn't sign up, you can ignore ` +
    `this email and no account will be created.\n`
  );
}

function verificationHtml(email: string, link: string): string {
  return (
    `<p>Hi ${esc(email)},</p>` +
    `<p>Thanks for signing up. Click below to verify your email and activate ` +
    `your TaskMind account:</p>` +
    `<p style="margin:16px 0"><a href="${esc(link)}">Verify my email</a></p>` +
    `<p>If the button above doesn't work, paste this URL into your browser:</p>` +
    `<p style="font-size:12px;word-break:break-all">${esc(link)}</p>` +
    `<p style="margin-top:24px;font-size:12px;color:#666">This link expires ` +
    `in 24 hours. If you didn't sign up, you can safely ignore this email.</p>`
  );
}

function resetText(email: string, link: string): string {
  return (
    `${APP_NAME} - reset your password\n\n` +
    `Hi ${email},\n\n` +
    `You requested a password reset. Click the link below - it expires in 1 ` +
    `hour:\n\n${link}\n\n` +
    `If you didn't request this, you can ignore this email.\n`
  );
}

function resetHtml(email: string, link: string): string {
  return (
    `<p>Hi ${esc(email)},</p>` +
    `<p>You requested a password reset. Click below to choose a new password. ` +
    `This link expires in 1 hour:</p>` +
    `<p style="margin:16px 0"><a href="${esc(link)}">Reset my password</a></p>` +
    `<p style="font-size:12px;word-break:break-all">${esc(link)}</p>` +
    `<p style="margin-top:24px;font-size:12px;color:#666">If you didn't ` +
    `request this, you can safely ignore this email.</p>`
  );
}


