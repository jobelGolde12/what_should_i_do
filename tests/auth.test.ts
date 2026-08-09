import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateSignedToken,
  validateSignedToken,
  hashToken,
  verificationLink,
  resetLink,
} from "@/lib/auth/verify";
import {
  createUser,
  findUserByEmail,
  setUserVerified,
  storeVerificationToken,
  hasVerificationToken,
  consumeVerificationToken,
  storePasswordReset,
  findPasswordReset,
  consumePasswordReset,
  setNewPassword,
} from "@/lib/auth/users";
import { hashPassword, verifyPassword, signSession, verifySession } from "@/lib/auth/session";
import { rateLimitDb, rlKey } from "@/lib/rateLimitDb";
import { getDb, ensureSchema } from "@/lib/db";

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM email_verifications");
  await db.execute("DELETE FROM password_resets");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM board_items");
  await db.execute("DELETE FROM templates");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM rate_limits");
  await db.execute("DELETE FROM users");
}

describe("Auth & Email Verification Tokens", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("generates and validates signed tokens before expiry", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", 60000);
    expect(tokenObj.token).toContain(".");
    expect(tokenObj.tokenHash).toHaveLength(64); // SHA-256 hex

    const payload = validateSignedToken(tokenObj.token, 60000);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("usr_123");
    expect(payload?.email).toBe("test@example.com");
  });

  it("rejects expired signed tokens", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", -1000); // expired 1s ago
    const payload = validateSignedToken(tokenObj.token, 60000);
    expect(payload).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", 60000);
    const tampered = tokenObj.token + "invalid";
    expect(validateSignedToken(tampered, 60000)).toBeNull();
  });

  it("builds correct verification and reset links", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", 60000);
    const vLink = verificationLink(tokenObj.token);
    const rLink = resetLink(tokenObj.token);
    expect(vLink).toContain("/auth/verify?token=");
    expect(rLink).toContain("/auth/reset-password?token=");
  });

  it("persists, verifies, and consumes single-use email verification tokens", async () => {
    const user = await createUser("unverified@example.com", hashPassword("secret123"));
    expect(user.verified).toBe(false);

    const tokenObj = generateSignedToken(user.id, user.email, 3600000);
    await storeVerificationToken(user.id, tokenObj.tokenHash, tokenObj.expiresAt);

    expect(await hasVerificationToken(tokenObj.tokenHash)).toBe(true);

    const consumed = await consumeVerificationToken(tokenObj.tokenHash);
    expect(consumed).toBe(true);
    expect(await hasVerificationToken(tokenObj.tokenHash)).toBe(false);

    await setUserVerified(user.id, Date.now());
    const updated = await findUserByEmail("unverified@example.com");
    expect(updated?.verified).toBe(true);
    expect(updated?.emailVerifiedAt).toBeGreaterThan(0);
  });

  it("stores, retrieves, and consumes single-use password reset tokens", async () => {
    const user = await createUser("reset@example.com", hashPassword("oldpass123"));
    const tokenObj = generateSignedToken(user.id, user.email, 3600000);

    await storePasswordReset(user.id, tokenObj.tokenHash, tokenObj.expiresAt);

    const found = await findPasswordReset(tokenObj.tokenHash);
    expect(found).not.toBeNull();
    expect(found?.userId).toBe(user.id);

    const consumed = await consumePasswordReset(tokenObj.tokenHash);
    expect(consumed).toBe(true);
    expect(await findPasswordReset(tokenObj.tokenHash)).toBeNull();

    await setNewPassword(user.id, hashPassword("newpass123"));
    const reloaded = await findUserByEmail("reset@example.com");
    expect(verifyPassword("newpass123", reloaded!.passwordHash)).toBe(true);
    expect(verifyPassword("oldpass123", reloaded!.passwordHash)).toBe(false);
  });

  it("enforces rate limits using rateLimitDb", async () => {
    const key = rlKey("test-action", "127.0.0.1");
    const r1 = await rateLimitDb(key, 2);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await rateLimitDb(key, 2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await rateLimitDb(key, 2);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("signs and verifies session tokens", () => {
    const token = signSession({ sub: "usr_999", email: "session@example.com" });
    const payload = verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("usr_999");
    expect(payload?.email).toBe("session@example.com");
  });
});
