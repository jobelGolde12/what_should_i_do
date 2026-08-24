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
import type {
  AnalysisRecord,
  Template,
  BoardItem,
  ChatTopic,
} from "@/lib/types";

export type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  emailVerifiedAt: number | null;
  createdAt: number;
  authVersion: number;
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
  authVersion: number;
} {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    verified: Number(row.verified) === 1,
    emailVerifiedAt:
      row.email_verified_at == null ? null : Number(row.email_verified_at),
    createdAt: Number(row.created_at),
    authVersion: Number(row.auth_version ?? 0),
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
      "SELECT id, timestamp, input, output, source_label FROM analyses WHERE user_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC",
      [userId],
    ],
    [
      "SELECT id, name, content, created_at FROM templates WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    ],
    [
      "SELECT id, source_id, source_index, text, urgency, status, created_at FROM board_items WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
      [userId],
    ],
  ]);
  return {
    history: (hist.rows ?? []).map((r) => ({
      id: r.id,
      timestamp: Number(r.timestamp),
      input: r.input,
      output: safeJsonParse(r.output),
      ...(r.source_label ? { sourceLabel: r.source_label as string } : {}),
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
    authVersion: 0,
    data: { history: [], templates: [], board: [] },
  };
}

/** Lightweight auth lookup (id, email, verified, auth_version) without synced
 * data. Used by `getCurrentUserId` so sessions are always checked against the
 * DB and version-bumped (revoked) sessions are rejected. */
export type UserAuth = { id: string; email: string; verified: boolean; authVersion: number };

export async function findUserAuthById(id: string): Promise<UserAuth | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT id, email, verified, auth_version FROM users WHERE id = ?",
    [id]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    verified: Number(row.verified) === 1,
    authVersion: Number(row.auth_version ?? 0),
  };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT id, email, password_hash, verified, email_verified_at, created_at, auth_version FROM users WHERE email = ?",
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
    "SELECT id, email, password_hash, verified, email_verified_at, created_at, auth_version FROM users WHERE id = ?",
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
  const now = Date.now();
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
      sql: "INSERT INTO analyses(id, user_id, timestamp, input, output, updated_at, source_label) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        r.id,
        id,
        r.timestamp,
        r.input,
        JSON.stringify(r.output),
        now,
        r.sourceLabel ?? null,
      ],
    });
  }
  for (const t of data.templates) {
    const tt = t as Template;
    if (++n > MAX_SYNC_ROWS) break;
    stmts.push({
      sql: "INSERT INTO templates(id, user_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [tt.id, id, tt.name, tt.content, tt.createdAt, now],
    });
  }
  for (const b of data.board) {
    const bb = b as BoardItem;
    if (++n > MAX_SYNC_ROWS) break;
    stmts.push({
      sql: "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [bb.id, id, bb.sourceId, bb.sourceIndex, bb.text, bb.urgency, bb.status, bb.createdAt, now],
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
   Auth-version counter (session + token revocation)
   =========================================================

   Every security-relevant event bumps `users.auth_version`:
   - a verification / reset link is issued (invalidates older links and all
     sessions signed with a previous version),
   - a password is set/changed (invalidates every existing session),
   - a token is consumed (verification) so it can never be replayed.

   Sessions and email links embed the version they were issued under; anything
   carrying a stale version is rejected by `getCurrentUser` / `verifyEmailToken`
   / `verifyResetToken`.
 */

export async function bumpAuthVersion(userId: string): Promise<number> {
  const database = await db();
  await database.execute(
    "UPDATE users SET auth_version = auth_version + 1 WHERE id = ?",
    [userId]
  );
  const res = await database.execute(
    "SELECT auth_version FROM users WHERE id = ?",
    [userId]
  );
  return res.rows?.length ? Number(res.rows[0].auth_version ?? 0) : 0;
}

/** Marks the account verified, bumps the auth version (so the consumed token
 * can never be replayed), and returns the NEW version for session signing. */
export async function setUserVerified(
  userId: string,
  emailVerifiedAt: number
): Promise<number> {
  const database = await db();
  await database.execute(
    "UPDATE users SET verified = 1, email_verified_at = ? WHERE id = ?",
    [emailVerifiedAt, userId]
  );
  return bumpAuthVersion(userId);
}

/** Marks the account unverified AND invalidates existing sessions/tokens. */
export async function markUserUnverified(userId: string): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE users SET verified = 0, email_verified_at = NULL WHERE id = ?",
    [userId]
  );
  await bumpAuthVersion(userId);
}

/** Sets a new password and revokes every session signed under the old one. */
export async function setNewPassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, userId]
  );
  await bumpAuthVersion(userId);
}
/* =========================================================
   Per-record incremental sync (Phase 2)
   ========================================================= */

export async function upsertAnalysis(
  userId: string,
  record: AnalysisRecord
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute(
    "INSERT INTO analyses(id, user_id, timestamp, input, output, updated_at, source_label, deleted_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, NULL) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET timestamp = excluded.timestamp, input = excluded.input, output = excluded.output, updated_at = excluded.updated_at, source_label = excluded.source_label, deleted_at = NULL",
    [
      record.id,
      userId,
      record.timestamp,
      record.input,
      JSON.stringify(record.output),
      now,
      record.sourceLabel ?? null,
    ]
  );
}

export async function upsertTemplate(
  userId: string,
  template: Template
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute(
    "INSERT INTO templates(id, user_id, name, content, created_at, updated_at, deleted_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, NULL) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET name = excluded.name, content = excluded.content, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = NULL",
    [template.id, userId, template.name, template.content, template.createdAt, now]
  );
}

export async function upsertBoardItem(
  userId: string,
  item: BoardItem
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute(
    "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at, updated_at, deleted_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET source_id = excluded.source_id, source_index = excluded.source_index, text = excluded.text, urgency = excluded.urgency, status = excluded.status, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = NULL",
    [
      item.id,
      userId,
      item.sourceId,
      item.sourceIndex,
      item.text,
      item.urgency,
      item.status,
      item.createdAt,
      now,
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
    "UPDATE board_items SET status = ?, updated_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL",
    [status, Date.now(), userId, id]
  );
}

export async function deleteAnalysis(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const now = Date.now();
  const res = await database.execute(
    "UPDATE analyses SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL",
    [now, now, userId, id]
  );
  return Number(res.rowsAffected);
}

export async function deleteTemplate(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const now = Date.now();
  const res = await database.execute(
    "UPDATE templates SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL",
    [now, now, userId, id]
  );
  return Number(res.rowsAffected);
}

export async function deleteBoardItem(
  userId: string,
  id: string
): Promise<number> {
  const database = await db();
  const now = Date.now();
  const res = await database.execute(
    "UPDATE board_items SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL",
    [now, now, userId, id]
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

export async function deleteSetting(userId: string, key: string): Promise<void> {
  const database = await db();
  await database.execute("DELETE FROM user_settings WHERE user_id = ? AND key = ?", [
    userId,
    key,
  ]);
}
/* =========================================================
   Analysis chat topics (persisted conversations)
   ========================================================= */

/** Defensive cap on stored turns per topic (malicious-input guard). */
export const MAX_CHAT_MESSAGES = 200;

function chatTopicFromRow(r: RawRow): ChatTopic | null {
  const id = r.id as string;
  if (typeof id !== "string" || !id) return null;
  const messages = safeJsonParse(r.messages);
  return {
    id,
    recordId: String(r.record_id ?? ""),
    ...(r.title ? { title: String(r.title) } : {}),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
    context: {
      input: String(r.context_input ?? ""),
      analysis: (safeJsonParse(r.context_analysis) ?? {}) as ChatTopic["context"]["analysis"],
    },
    messages: Array.isArray(messages)
      ? (messages as ChatTopic["messages"]).filter(
          (m) =>
            m &&
            typeof m === "object" &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
      : [],
  };
}

export async function upsertChatTopic(
  userId: string,
  topic: ChatTopic
): Promise<void> {
  const database = await db();
  await database.execute(
    "INSERT INTO chat_topics(id, user_id, record_id, title, context_input, context_analysis, messages, created_at, updated_at, deleted_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET record_id = excluded.record_id, title = excluded.title, " +
      "context_input = excluded.context_input, context_analysis = excluded.context_analysis, " +
      "messages = excluded.messages, updated_at = excluded.updated_at, deleted_at = NULL",
    [
      topic.id.slice(0, 200),
      userId,
      topic.recordId.slice(0, 200),
      (topic.title ?? "").slice(0, 120),
      topic.context.input,
      JSON.stringify(topic.context.analysis ?? {}),
      JSON.stringify((topic.messages ?? []).slice(-MAX_CHAT_MESSAGES)),
      topic.createdAt,
      Date.now(),
    ]
  );
}

export async function getChatTopicsByRecord(
  userId: string,
  recordId: string
): Promise<ChatTopic[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM chat_topics WHERE user_id = ? AND record_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
    [userId, recordId]
  );
  const out: ChatTopic[] = [];
  for (const row of res.rows ?? []) {
    const topic = chatTopicFromRow(row as RawRow);
    if (topic) out.push(topic);
  }
  return out;
}

export async function deleteChatTopicsByRecord(
  userId: string,
  recordId: string
): Promise<number> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM chat_topics WHERE user_id = ? AND record_id = ?",
    [userId, recordId]
  );
  return Number(res.rowsAffected);
}

/* =========================================================
   Incremental sync (Pro): per-record deltas + tombstones.
   ========================================================= */

export type SyncCollection = "history" | "templates" | "board" | "settings";

export const SYNC_COLLECTIONS: readonly SyncCollection[] = [
  "history",
  "templates",
  "board",
  "settings",
];

/**
 * One directional sync change. `record` carries the client-facing record
 * object (same shape as `AuthData`) when `deleted` is false; for settings the
 * record is `{ key, value }`.
 */
export type SyncChange = {
  collection: SyncCollection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  record?: unknown;
};

/** Loose validation used by the sync route before applying client deltas. */
export function isSyncChange(value: unknown): value is SyncChange {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  if (!SYNC_COLLECTIONS.includes(c.collection as SyncCollection)) return false;
  if (typeof c.id !== "string" || c.id.length === 0 || c.id.length > 200) return false;
  if (typeof c.updatedAt !== "number" || !Number.isFinite(c.updatedAt) || c.updatedAt < 0) return false;
  if (typeof c.deleted !== "boolean") return false;
  if (!c.deleted && (typeof c.record !== "object" || c.record === null)) return false;
  return true;
}

const SYNC_TABLES: Record<SyncCollection, string> = {
  history: "analyses",
  templates: "templates",
  board: "board_items",
  settings: "user_settings",
};

type RawRow = Record<string, unknown>;

function analysisRecordFromRow(r: RawRow): unknown {
  return {
    id: r.id,
    timestamp: Number(r.timestamp),
    input: r.input,
    output: safeJsonParse(r.output),
    ...(r.source_label ? { sourceLabel: r.source_label as string } : {}),
  };
}

function templateRecordFromRow(r: RawRow): unknown {
  return {
    id: r.id,
    name: r.name,
    content: r.content,
    createdAt: Number(r.created_at),
  };
}

function boardItemFromRow(r: RawRow): unknown {
  return {
    id: r.id,
    sourceId: r.source_id,
    sourceIndex: Number(r.source_index),
    text: r.text,
    urgency: r.urgency,
    status: r.status,
    createdAt: Number(r.created_at),
  };
}

function changeFromRow(
  collection: SyncCollection,
  r: RawRow
): SyncChange | null {
  const id = r.id as string;
  if (typeof id !== "string" || !id) return null;
  const deletedAt = r.deleted_at;
  const deleted = deletedAt != null;
  if (collection === "settings") {
    return {
      collection,
      id,
      updatedAt: Number(r.updated_at ?? 0),
      deleted: false,
      record: { key: id, value: safeJsonParse(r.value) },
    };
  }
  const record = deleted
    ? undefined
    : collection === "history"
      ? analysisRecordFromRow(r)
      : collection === "templates"
        ? templateRecordFromRow(r)
        : boardItemFromRow(r);
  return { collection, id, updatedAt: Number(r.updated_at ?? 0), deleted, record };
}

/** Returns every record (live or tombstoned) updated after `since`. */
export async function getSyncChanges(
  userId: string,
  since: number
): Promise<SyncChange[]> {
  const database = await db();
  const tables = [SYNC_TABLES.history, SYNC_TABLES.templates, SYNC_TABLES.board];
  const out: SyncChange[] = [];
  for (const table of tables) {
    const col = table === "analyses" ? "history" : table === "templates" ? "templates" : "board";
    const res = await database.execute(
      `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ?`,
      [userId, since]
    );
    for (const row of res.rows ?? []) {
      const change = changeFromRow(col as SyncCollection, row as RawRow);
      if (change) out.push(change);
    }
  }
  const settings = await database.execute(
    "SELECT key, value, updated_at FROM user_settings WHERE user_id = ? AND updated_at > ?",
    [userId, since]
  );
  for (const row of settings.rows ?? []) {
    const change = changeFromRow("settings", { id: row.key, value: row.value, updated_at: row.updated_at } as RawRow);
    if (change) out.push(change);
  }
  return out;
}

/** Fetches the current server-side state of a single record (or null). */
async function readServerChange(
  userId: string,
  collection: SyncCollection,
  id: string
): Promise<SyncChange | null> {
  const database = await db();
  const table = SYNC_TABLES[collection];
  const idColumn = collection === "settings" ? "key" : "id";
  const res = await database.execute(
    `SELECT * FROM ${table} WHERE user_id = ? AND ${idColumn} = ?`,
    [userId, id]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as RawRow;
  if (collection === "settings") {
    return changeFromRow("settings", {
      id: row.key,
      value: row.value,
      updated_at: row.updated_at,
    } as RawRow);
  }
  return changeFromRow(collection, row);
}

/**
 * Applies a batch of client deltas with last-write-wins semantics (a change is
 * rejected when the stored `updated_at` is newer). Returns the rejected
 * changes with their current server-side state so the caller can re-merge.
 * Each change is applied atomically; a failing record never partially applies.
 */
export async function applySyncChanges(
  userId: string,
  changes: SyncChange[]
): Promise<SyncChange[]> {
  const database = await db();
  const rejected: SyncChange[] = [];
  for (const change of changes) {
    if (change.collection === "settings") {
      const key = change.id;
      if (change.deleted) {
        const res = await database.execute(
          "SELECT updated_at FROM user_settings WHERE user_id = ? AND key = ?",
          [userId, key]
        );
        const current = res.rows?.length ? Number(res.rows[0].updated_at ?? 0) : 0;
        if (change.updatedAt >= current) {
          await database.execute(
            "DELETE FROM user_settings WHERE user_id = ? AND key = ?",
            [userId, key]
          );
        } else {
          const server = await readServerChange(userId, "settings", key);
          if (server) rejected.push(server);
        }
        continue;
      }
      const record = (change.record ?? {}) as Record<string, unknown>;
      const value = record.value ?? null;
      const res = await database.execute(
        "SELECT updated_at FROM user_settings WHERE user_id = ? AND key = ?",
        [userId, key]
      );
      const current = res.rows?.length ? Number(res.rows[0].updated_at ?? 0) : 0;
      if (change.updatedAt < current) {
        const server = await readServerChange(userId, "settings", key);
        if (server) rejected.push(server);
        continue;
      }
      await database.execute(
        "INSERT INTO user_settings(user_id, key, value, updated_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [userId, key, JSON.stringify(value), change.updatedAt]
      );
      continue;
    }

    const table = SYNC_TABLES[change.collection];
    const res = await database.execute(
      `SELECT updated_at FROM ${table} WHERE user_id = ? AND id = ?`,
      [userId, change.id]
    );
    const current = res.rows?.length ? Number(res.rows[0].updated_at ?? 0) : 0;
    if (change.updatedAt < current) {
      const server = await readServerChange(userId, change.collection, change.id);
      if (server) rejected.push(server);
      continue;
    }

    if (change.deleted) {
      // Tombstone: mark the row deleted at the change's clock.
      if (change.collection === "history") {
        await database.execute(
          "INSERT INTO analyses(id, user_id, timestamp, input, output, updated_at, deleted_at) " +
            "VALUES (?, ?, ?, '', '', ?, ?) " +
            "ON CONFLICT(user_id, id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
          [change.id, userId, change.updatedAt, change.updatedAt, change.updatedAt]
        );
      } else if (change.collection === "templates") {
        await database.execute(
          "INSERT INTO templates(id, user_id, name, content, created_at, updated_at, deleted_at) " +
            "VALUES (?, ?, '', '', ?, ?, ?) " +
            "ON CONFLICT(user_id, id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
          [change.id, userId, change.updatedAt, change.updatedAt, change.updatedAt]
        );
      } else {
        await database.execute(
          "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at, updated_at, deleted_at) " +
            "VALUES (?, ?, '', 0, '', '', '', ?, ?, ?) " +
            "ON CONFLICT(user_id, id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
          [change.id, userId, change.updatedAt, change.updatedAt, change.updatedAt]
        );
      }
      continue;
    }

    // Live upsert.
    if (change.collection === "history") {
      const r = (change.record ?? {}) as Partial<AnalysisRecord>;
      await database.execute(
        "INSERT INTO analyses(id, user_id, timestamp, input, output, updated_at, source_label, deleted_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, NULL) " +
          "ON CONFLICT(user_id, id) DO UPDATE SET timestamp = excluded.timestamp, input = excluded.input, output = excluded.output, updated_at = excluded.updated_at, source_label = excluded.source_label, deleted_at = NULL",
        [
          change.id,
          userId,
          r.timestamp ?? 0,
          r.input ?? "",
          JSON.stringify(r.output ?? {}),
          change.updatedAt,
          r.sourceLabel ?? null,
        ]
      );
    } else if (change.collection === "templates") {
      const r = (change.record ?? {}) as Partial<Template>;
      await database.execute(
        "INSERT INTO templates(id, user_id, name, content, created_at, updated_at, deleted_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, NULL) " +
          "ON CONFLICT(user_id, id) DO UPDATE SET name = excluded.name, content = excluded.content, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = NULL",
        [change.id, userId, r.name ?? "", r.content ?? "", r.createdAt ?? 0, change.updatedAt]
      );
    } else {
      const r = (change.record ?? {}) as Partial<BoardItem>;
      await database.execute(
        "INSERT INTO board_items(id, user_id, source_id, source_index, text, urgency, status, created_at, updated_at, deleted_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) " +
          "ON CONFLICT(user_id, id) DO UPDATE SET source_id = excluded.source_id, source_index = excluded.source_index, text = excluded.text, urgency = excluded.urgency, status = excluded.status, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = NULL",
        [
          change.id,
          userId,
          r.sourceId ?? "",
          r.sourceIndex ?? 0,
          r.text ?? "",
          r.urgency ?? "Normal",
          r.status ?? "todo",
          r.createdAt ?? 0,
          change.updatedAt,
        ]
      );
    }
  }
  return rejected;
}



