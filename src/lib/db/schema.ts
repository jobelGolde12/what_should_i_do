/**
 * Turso (libSQL) schema definitions for TaskMind.
 *
 * All DDL is idempotent (`CREATE TABLE IF NOT EXISTS`) so `ensureSchema()` is
 * safe to call repeatedly. Schema version is tracked in `schema_migrations`
 * so future migrations run only when the version advances.
 */

/** Bump this when you add/modify tables; ensureSchema() applies the delta. */
export const SCHEMA_VERSION = 1;

/**
 * Returns the DDL statements needed to reach `SCHEMA_VERSION` from scratch.
 * Each entry is a single SQL string that may contain multiple statements
 * (libSQL / SQLite supports multiple statements per `execute` for DDL).
 */
export const SCHEMA_DDL: string[] = [
  // —— Accounts & auth state ——
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    email_verified_at INTEGER,
    created_at INTEGER NOT NULL
  )`,

  // Single-use verification tokens (the token sent by email; only the hash is stored).
  `CREATE TABLE IF NOT EXISTS email_verifications (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  // Single-use password-reset tokens.
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  // —— Synced user data (replaces the opaque `data` blob) ——
  `CREATE TABLE IF NOT EXISTS analyses (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,

  `CREATE TABLE IF NOT EXISTS board_items (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    source_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,

  `CREATE TABLE IF NOT EXISTS templates (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,

  // —— Shared rate limiting (DB-backed for multi-instance deployments) ——
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, window_start)
  )`,

  // —— Schema version tracking ——
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`,
];
