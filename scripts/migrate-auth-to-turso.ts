import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ensureSchema, getDb } from "../src/lib/db/index";
import { updateUserData } from "../src/lib/auth/users";

type LegacyUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  data?: {
    history?: unknown[];
    templates?: unknown[];
    board?: unknown[];
  };
};

async function migrateLegacyJson() {
  const jsonPath = join(process.cwd(), ".data", "users.json");
  if (!existsSync(jsonPath)) {
    console.log("[migrate-auth] No legacy .data/users.json found. Skipping JSON backfill.");
    return;
  }

  console.log(`[migrate-auth] Reading legacy JSON store from ${jsonPath}...`);
  await ensureSchema();
  const db = getDb();

  let raw = "";
  try {
    raw = readFileSync(jsonPath, "utf8");
  } catch (err) {
    console.error("[migrate-auth] Failed to read users.json:", err);
    return;
  }

  let users: LegacyUser[] = [];
  try {
    const parsed = JSON.parse(raw);
    users = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch (err) {
    console.error("[migrate-auth] Failed to parse users.json:", err);
    return;
  }

  console.log(`[migrate-auth] Found ${users.length} user record(s) in JSON store.`);

  let migratedCount = 0;
  for (const u of users) {
    if (!u.id || !u.email || !u.passwordHash) continue;
    const email = u.email.toLowerCase();

    // Check if user already exists in Turso
    const existing = await db.execute("SELECT id FROM users WHERE email = ? OR id = ?", [
      email,
      u.id,
    ]);

    if (existing.rows.length === 0) {
      await db.execute(
        "INSERT INTO users (id, email, password_hash, verified, email_verified_at, created_at) VALUES (?, ?, ?, 1, ?, ?)",
        [u.id, email, u.passwordHash, Date.now(), u.createdAt || Date.now()]
      );
      migratedCount++;
    }

    if (u.data) {
      await updateUserData(u.id, {
        history: Array.isArray(u.data.history) ? u.data.history : [],
        templates: Array.isArray(u.data.templates) ? u.data.templates : [],
        board: Array.isArray(u.data.board) ? u.data.board : [],
      });
    }
  }

  console.log(`[migrate-auth] Migration complete. ${migratedCount} new user(s) imported into Turso.`);
}

migrateLegacyJson().catch((err) => {
  console.error("[migrate-auth] Fatal error during migration:", err);
  process.exit(1);
});
