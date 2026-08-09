/**
 * Turso (libSQL) backed user & sync-data repository.
 *
 * The public function signatures mirror the previous file-backed JSON store
 * (`createUser`, `findUserByEmail`, `findUserById`, `updateUserData`,
 * `deleteUser`) so existing call sites keep working — they are now `async` and
 * read/write the relational schema in `src/lib/db/schema.ts` instead of
 * `.data/users.json`.
 *
 * New methods back the verification flow (Phase 1), password reset (Phase 3)
 * and incremental per-record sync (Phase 2).
 */
import { getDb, ensureSchema } from "@/lib/db";
import { uid } from "@/lib/storage";
import type { AnalysisRecord, Template, BoardItem } from "@/lib/types";

export type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  emailVerifiedAt: number | null;
  createdAt: number;
  data: {
    history: unknown[];
    templates: unknown[];
    board: unknown[];
  };
};

/** Defensive cap on rows written in a single sync patch (malicious-input guard). */
export const MAX_SYNC_ROWS = 5000;

async function db(): Promise<ReturnType<typeof getDb>> {
  await ensureSchema();
  return getDb();
}

function rowToBase(row: Record<string, unknown>): {
  id: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  emailVerifiedAt: number | null;
  createdAt: number;
} {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    verified: Number(row.verified) === 1,
    emailVerifiedAt:
      row.email_verified_at == null ? null : Number(row.email_verified_at),
    createdAt: Number(row.created_at),
  };
}

export type UserData = StoredUser["data"];

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Reads the three synced collections for a user as plain objects/arrays. */
async function loadUserData(userId: string): Promise<UserData> {
  const database = await db();
  const [hist, tmpl, board] = await database.batch([
    [
      "SELECT id, timestamp, input, output FROM analyses WHERE user_id = ? ORDER BY timestamp DESC",
      [userId],
    ],
    [
      "SELECT id, name, content, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    ],
    [
      "SELECT id, source_id, source_index, text, urgency, status, created_at FROM board_items WHERE user_id = ? ORDER BY created_at ASC",
      [userId],
    ],
  ]);
  return {
    history: (hist.rows ?? []).map((r) => ({
      id: r.id,
      timestamp: Number(r.timestamp),
      input: r.input,
      output: safeJsonParse(r.output),
    })),
    templates: (tmpl.rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      createdAt: Number(r.created_at),
    })),
    board: (board.rows ?? []).map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceIndex: Number(r.source_index),
      text: r.text,
      urgency: r.urgency,
      status: r.status,
      createdAt: Number(r.created_at),
    })),
  };
}

function toStoredUser(row: Record<string, unknown>, data: UserData): StoredUser {
  return { ...rowToBase(row), data };
}
/* =========================================================
   Accounts
   ========================================================= */

export async function createUser(
  email: string,
  passwordHash: string
): Promise<StoredUser> {
  const database = await db();
  const id = uid();
  const now = Date.now();
  await database.execute(
    "INSERT INTO users (id, email, password_hash, verified, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, email.toLowerCase(), passwordHash, 0, null, now]
  );
  return {
    id,
    email,
    passwordHash,
    verified: false,
    emailVerifiedAt: null,
    createdAt: now,
    data: { history: [], templates: [], board: [] },
  };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT id, email, password_hash, verified, email_verified_at, created_at FROM users WHERE email = ?",
    [email.toLowerCase()]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as Record<string, unknown>;
  const data = await loadUserData(row.id as string);
  return toStoredUser(row, data);
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT id, email, password_hash, verified, email_verified_at, created_at FROM users WHERE id = ?",
    [id]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as Record<string, unknown>;
  const data = await loadUserData(row.id as string);
  return toStoredUser(row, data);
}

import type { InStatement } from "@libsql/client";

export async function updateUserData(
  id: string,
  data: UserData
): Promise<StoredUser | null> {
  const database = await db();
  const stmts: InStatement[] = [
    { sql: "DELETE FROM analyses WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM board_items WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM templates WHERE user_id = ?", args: [id] },
  ];
  let n = 0;
  for (const h of data.history) {
    const r = h as AnalysisRecord;
    if (++n > MAX_SYNC_ROWS) break;
    stmts.push({
      sql: "INSERT INTO analyses(id, user_id, timestamp, input, output) VALUES (?, ?, ?, ?, ?)",
      args: [r.id, id, r.timestamp, r.input, JSON.stringify(r.output)],
    });
  }
  for (const t of data.templates) {
    const tt = t as Template;
    stmts.push({
      sql: "INSERT INTO templates(id, user_id, name, content, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [tt.id, id, tt.name, tt.content, tt.createdAt],
    });
  }
  for (const b of data.board) {
    const bb = b as BoardItem;
    stmts.push({
      sql: "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [bb.id, id, bb.sourceId, bb.sourceIndex, bb.text, bb.urgency, bb.status, bb.createdAt],
    });
  }
  await database.batch(stmts);
  return findUserById(id);
}

export async function deleteUser(id: string): Promise<boolean> {
  const database = await db();
  const res = await database.batch([
    ["DELETE FROM email_verifications WHERE user_id = ?", [id]],
    ["DELETE FROM password_resets WHERE user_id = ?", [id]],
    ["DELETE FROM analyses WHERE user_id = ?", [id]],
    ["DELETE FROM board_items WHERE user_id = ?", [id]],
    ["DELETE FROM templates WHERE user_id = ?", [id]],
    ["DELETE FROM user_settings WHERE user_id = ?", [id]],
    ["DELETE FROM users WHERE id = ?", [id]],
  ]);
  return Number(res[res.length - 1].rowsAffected) > 0;
}
/* =========================================================
   Email verification tokens (single-use, stored as hash)
   ========================================================= */

export async function storeVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: number
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute("DELETE FROM email_verifications WHERE user_id = ?", [
    userId,
  ]);
  await database.execute(
    "INSERT INTO email_verifications(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [tokenHash, userId, expiresAt, now]
  );
}

export async function hasVerificationToken(
  tokenHash: string
): Promise<boolean> {
  const database = await db();
  const res = await database.execute(
    "SELECT 1 FROM email_verifications WHERE token_hash = ?",
    [tokenHash]
  );
  return res.rows.length > 0;
}

export async function consumeVerificationToken(
  tokenHash: string
): Promise<boolean> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM email_verifications WHERE token_hash = ?",
    [tokenHash]
  );
  return Number(res.rowsAffected) > 0;
}

export async function setUserVerified(
  userId: string,
  emailVerifiedAt: number
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE users SET verified = 1, email_verified_at = ? WHERE id = ?",
    [emailVerifiedAt, userId]
  );
}

export async function markUserUnverified(userId: string): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE users SET verified = 0, email_verified_at = NULL WHERE id = ?",
    [userId]
  );
}

/* =========================================================
   Password-reset tokens (single-use, stored as hash)
   ========================================================= */

export async function storePasswordReset(
  userId: string,
  tokenHash: string,
  expiresAt: number
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute("DELETE FROM password_resets WHERE user_id = ?", [
    userId,
  ]);
  await database.execute(
    "INSERT INTO password_resets(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [tokenHash, userId, expiresAt, now]
  );
}

export type PasswordResetRow = { userId: string; expiresAt: number };

export async function findPasswordReset(
  tokenHash: string
): Promise<PasswordResetRow | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?",
    [tokenHash]
  );
  if (!res.rows?.length) return null;
  return {
    userId: res.rows[0].user_id as string,
    expiresAt: Number(res.rows[0].expires_at),
  };
}

export async function consumePasswordReset(
  tokenHash: string
): Promise<boolean> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM password_resets WHERE token_hash = ?",
    [tokenHash]
  );
  return Number(res.rowsAffected) > 0;
}

export async function setNewPassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, userId]
  );
}
/* =========================================================
   Per-record incremental sync (Phase 2)
   ========================================================= */

export async function upsertAnalysis(
  userId: string,
  record: AnalysisRecord
): Promise<void> {
  const database = await db();
  await database.execute(
    "INSERT INTO analyses(id, user_id, timestamp, input, output) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET timestamp = excluded.timestamp, input = excluded.input, output = excluded.output",
    [
      record.id,
      userId,
      record.timestamp,
      record.input,
      JSON.stringify(record.output),
    ]
  );
}

export async function upsertTemplate(
  userId: string,
  template: Template
): Promise<void> {
  const database = await db();
  await database.execute(
    "INSERT INTO templates(id, user_id, name, content, created_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET name = excluded.name, content = excluded.content, created_at = excluded.created_at",
    [
      template.id,
      userId,
      template.name,
      template.content,
      template.createdAt,
    ]
  );
}

export async function upsertBoardItem(
  userId: string,
  item: BoardItem
): Promise<void> {
  const database = await db();
  await database.execute(
    "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET source_id = excluded.source_id, source_index = excluded.source_index, text = excluded.text, urgency = excluded.urgency, status = excluded.status, created_at = excluded.created_at",
    [
      item.id,
      userId,
      item.sourceId,
      item.sourceIndex,
      item.text,
      item.urgency,
      item.status,
      item.createdAt,
    ]
  );
}

export async function setBoardItemStatus(
  userId: string,
  id: string,
  status: BoardItem["status"]
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE board_items SET status = ? WHERE user_id = ? AND id = ?",
    [status, userId, id]
  );
}

export async function deleteAnalysis(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM analyses WHERE user_id = ? AND id = ?",
    [userId, id]
  );
  return Number(res.rowsAffected);
}

export async function deleteTemplate(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM templates WHERE user_id = ? AND id = ?",
    [userId, id]
  );
  return Number(res.rowsAffected);
}

export async function deleteBoardItem(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM board_items WHERE user_id = ? AND id = ?",
    [userId, id]
  );
  return Number(res.rowsAffected);
}

export async function upsertSetting(
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute(
    "INSERT INTO user_settings(user_id, key, value, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [userId, key, JSON.stringify(value), now]
  );
}

export type SettingsRecord = Record<string, unknown>;

export async function getSettings(userId: string): Promise<SettingsRecord> {
  const database = await db();
  const res = await database.execute(
    "SELECT key, value FROM user_settings WHERE user_id = ?",
    [userId]
  );
  const out: SettingsRecord = {};
  for (const row of res.rows ?? []) {
    const key = row.key as string;
    let value: unknown = row.value;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep raw string */
      }
    }
    out[key] = value;
  }
  return out;
}



