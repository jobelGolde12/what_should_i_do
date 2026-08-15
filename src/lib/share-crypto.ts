import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { SharePayload } from "./types";

/**
 * Server-only share-token crypto (imports node:crypto, so it must never be
 * imported from client code). Client-safe helpers live in `./share`.
 *
 * Tokens are encrypted with AES-256-GCM using a server-only secret
 * (`SHARE_SECRET`, falling back to `AUTH_SECRET`). The key never leaves the
 * server, so the raw input hidden behind the `sensitive` flag cannot be
 * recovered by decoding the URL alone — an authenticated-tamper check rejects
 * any modified token.
 *
 * Token format:  `enc:<base64url(iv | ciphertext | authTag)>`
 *
 * Legacy (pre-encryption) base64 tokens were dropped in the security pass:
 * they were unauthenticated plaintext by design, and every share link now
 * expires 30 days after creation — long enough that no valid legacy link
 * remains. Accepting them would keep an unauthenticated decode path alive for
 * no benefit, so `decryptShareToken` only accepts `enc:` tokens.
 */

export const SHARE_PREFIX = "enc:";

// AES-256-GCM: 12-byte IV, 32-byte key (derived via SHA-256), 16-byte tag.
const IV_LEN = 12;
const TAG_LEN = 16;

/** Share links expire 30 days after the client-reported creation timestamp. */
export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Reject timestamps more than a minute in the future (client clock skew). */
const FUTURE_SKEW_MS = 60_000;

function shareExpired(payload: SharePayload): boolean {
  if (typeof payload.timestamp !== "number" || !Number.isFinite(payload.timestamp)) {
    return true;
  }
  const now = Date.now();
  if (payload.timestamp > now + FUTURE_SKEW_MS) return true;
  return now - payload.timestamp > SHARE_TTL_MS;
}

export function getShareSecret(): string | null {
  return process.env.SHARE_SECRET || process.env.AUTH_SECRET || null;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a share payload into a self-contained `enc:` token. Server-side. */
export function encryptSharePayload(
  payload: SharePayload,
  secret?: string
): string {
  const keySecret = secret ?? getShareSecret();
  if (!keySecret) throw new Error("share_secret_missing");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(keySecret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    SHARE_PREFIX +
    Buffer.concat([iv, ciphertext, tag]).toString("base64url")
  );
}

/** Decrypts an `enc:` token. Returns null on tampering / bad secret / wrong
 * format. Legacy unencrypted base64 tokens are no longer accepted. Server-side. */
export function decryptShareToken(
  token: string,
  secret?: string
): SharePayload | null {
  const keySecret = secret ?? getShareSecret();
  // Next.js may hand the route param back with the prefix colon percent-encoded
  // (`enc%3A…`), so normalize it before parsing.
  const normalized = token.replace(/%3A/gi, ":");
  if (!normalized.startsWith(SHARE_PREFIX)) return null;
  const body = normalized.slice(SHARE_PREFIX.length);

  if (!keySecret || !body) return null;
  try {
    const raw = Buffer.from(body, "base64url");
    if (raw.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(raw.length - TAG_LEN);
    const ciphertext = raw.subarray(IV_LEN, raw.length - TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(keySecret), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as SharePayload;
    if (!parsed || !parsed.output || !Array.isArray(parsed.output.actions))
      return null;
    if (shareExpired(parsed)) return null;
    return parsed;
  } catch {
    // Tampered ciphertext, wrong secret, expired, or malformed token.
    return null;
  }
}
