import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateSignedToken,
  validateSignedToken,
  verifyEmailToken,
  verifyResetToken,
  verificationLink,
  resetLink,
} from "@/lib/auth/verify";
import {
  createUser,
  findUserByEmail,
  setNewPassword,
  findUserAuthById,
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

    const payload = validateSignedToken(tokenObj.token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("usr_123");
    expect(payload?.email).toBe("test@example.com");
  });

  it("rejects expired signed tokens", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", -1000); // expired 1s ago
    const payload = validateSignedToken(tokenObj.token);
    expect(payload).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", 60000);
    const tampered = tokenObj.token + "invalid";
    expect(validateSignedToken(tampered)).toBeNull();
  });

  it("builds correct verification and reset links", () => {
    const tokenObj = generateSignedToken("usr_123", "test@example.com", 60000);
    const vLink = verificationLink(tokenObj.token);
    const rLink = resetLink(tokenObj.token);
    expect(vLink).toContain("/auth/verify?token=");
    expect(rLink).toContain("/auth/reset-password?token=");
  });

  it("verifies a stateless signed email token and makes it unusable (single-use)", async () => {
    const user = await createUser("unverified@example.com", hashPassword("secret123"));
    expect(user.verified).toBe(false);

    const tokenObj = generateSignedToken(user.id, user.email, 3600000, 0);
    const result = await verifyEmailToken(tokenObj.token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(user.id);
    expect(result?.authVersion).toBe(1);

    const updated = await findUserByEmail("unverified@example.com");
    expect(updated?.verified).toBe(true);
    expect(updated?.emailVerifiedAt).toBeGreaterThan(0);
    expect(updated?.authVersion).toBe(1);

    // Replaying the same token must fail (already verified + version bumped).
    expect(await verifyEmailToken(tokenObj.token)).toBeNull();
  });

  it("rejects stale verification tokens (newer link issued)", async () => {
    const user = await createUser("stale@example.com", hashPassword("secret123"));
    // Link issued at version 0…
    const oldToken = generateSignedToken(user.id, user.email, 3600000, 0);
    // …then a newer link is issued, bumping the auth version to 1.
    const db = getDb();
    await db.execute("UPDATE users SET auth_version = 1 WHERE id = ?", [user.id]);
    expect(await verifyEmailToken(oldToken.token)).toBeNull();
  });

  it("revokes sessions and tokens after a password change (auth_version)", async () => {
    const user = await createUser("reset@example.com", hashPassword("oldpass123"));
    expect(user.authVersion).toBe(0);

    const sessionBefore = signSession({ sub: user.id, email: user.email, v: 0 });
    expect(verifySession(sessionBefore)).not.toBeNull();

    const resetToken = generateSignedToken(user.id, user.email, 3600000, 0);
    const payload = await verifyResetToken(resetToken.token);
    expect(payload).not.toBeNull();

    await setNewPassword(user.id, hashPassword("newpass123"));
    const reloaded = await findUserByEmail("reset@example.com");
    expect(verifyPassword("newpass123", reloaded!.passwordHash)).toBe(true);
    expect(verifyPassword("oldpass123", reloaded!.passwordHash)).toBe(false);
    expect(reloaded?.authVersion).toBe(1);

    // The reset token cannot be replayed after the password changed.
    expect(await verifyResetToken(resetToken.token)).toBeNull();
    // A session signed under the old version is still a valid signature, but
    // the caller must reject it — mirrored in getCurrentUser/getCurrentUserId.
    const auth = await findUserAuthById(user.id);
    expect(auth?.authVersion).toBe(1);
    const stalePayload = verifySession(sessionBefore);
    expect(stalePayload).not.toBeNull();
    expect(stalePayload?.v ?? 0).not.toBe(auth?.authVersion);
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
