/**
 * Turso (libSQL) schema definitions for TaskMind.
 *
 * All DDL is idempotent (`CREATE TABLE IF NOT EXISTS`) so `ensureSchema()` is
 * safe to call repeatedly. Schema version is tracked in `schema_migrations`
 * so future migrations run only when the version advances.
 */

/** Bump this when you add/modify tables; ensureSchema() applies the delta. */
export const SCHEMA_VERSION = 7;

/**
 * Versioned migrations for databases that already exist. Each key is the target
 * version; the statements are applied (best-effort, duplicate columns ignored)
 * when `schema_migrations` reports a lower version. Fresh installs get the
 * columns from `SCHEMA_DDL` directly, so these ALTERs are only for upgrades.
 */
export const SCHEMA_MIGRATIONS: Record<number, string[]> = {
  3: [
    // Cloud sync: per-record `updated_at` (LWW clock) + `deleted_at` tombstone.
    "ALTER TABLE analyses ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE analyses ADD COLUMN deleted_at INTEGER",
    // Carry the source file label so history survives device sync intact.
    "ALTER TABLE analyses ADD COLUMN source_label TEXT",
    "ALTER TABLE board_items ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE board_items ADD COLUMN deleted_at INTEGER",
    "ALTER TABLE templates ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE templates ADD COLUMN deleted_at INTEGER",
    // Backfill timestamps for rows created before the migration so a first
    // sync (since = 0) still returns them.
    "UPDATE analyses SET updated_at = timestamp WHERE updated_at = 0",
    "UPDATE templates SET updated_at = created_at WHERE updated_at = 0",
    "UPDATE board_items SET updated_at = created_at WHERE updated_at = 0",
  ],
  4: [
    // Deadline reminders: speed up the cron sweep (remind_at <= now, unsent).
    "CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(user_id, sent, remind_at)",
  ],
  5: [
    // Pro inbox: message list from forwarded email.
    "CREATE TABLE IF NOT EXISTS inbox_messages (" +
      "id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
      "provider TEXT NOT NULL, external_id TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '', " +
      "subject TEXT NOT NULL DEFAULT '', snippet TEXT NOT NULL DEFAULT '', received_at INTEGER NOT NULL, " +
      "body TEXT NOT NULL DEFAULT '', analysis_id TEXT NOT NULL DEFAULT '', analyzed INTEGER NOT NULL DEFAULT 0, " +
      "replied INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, id))",
    "CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, provider)",
  ],
  6: [
    // Session/verification-token revocation: bump `auth_version` on every
    // security-relevant event (password change, token issue/consume) so any
    // session or email link signed with an older version is rejected.
    "ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0",
  ],
  7: [
    // Analysis chat topics: persisted conversations per analysis record.
    // `context_*` snapshots keep the chat self-grounding across devices even
    // when the underlying analysis isn't in the device's localStorage.
    "CREATE TABLE IF NOT EXISTS chat_topics (" +
      "id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
      "record_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', " +
      "context_input TEXT NOT NULL DEFAULT '', context_analysis TEXT NOT NULL DEFAULT '{}', " +
      "messages TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, " +
      "updated_at INTEGER NOT NULL, deleted_at INTEGER, PRIMARY KEY (user_id, id))",
    "CREATE INDEX IF NOT EXISTS idx_chat_topics_record ON chat_topics(user_id, record_id, updated_at)",
  ],
};

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
    created_at INTEGER NOT NULL,
    auth_version INTEGER NOT NULL DEFAULT 0
  )`,

  // Deprecated since SCHEMA_VERSION 6: verification/reset tokens are now
  // stateless signed URLs (single-use enforced by `users.auth_version`).
  // The tables are kept so older deployments can roll back cleanly.
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
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    source_label TEXT,
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
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
  )`,

  `CREATE TABLE IF NOT EXISTS templates (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,

  // —— Pro: subscriptions (billing) ——
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL DEFAULT '',
    stripe_subscription_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'free',
    price_id TEXT,
    current_period_end INTEGER,
    plan TEXT NOT NULL DEFAULT 'free',
    updated_at INTEGER NOT NULL
  )`,

  // —— Pro: usage metering (per metric, per window) ——
  `CREATE TABLE IF NOT EXISTS pro_usage (
    user_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, metric, window_start)
  )`,

  // —— Pro: Stripe webhook dedupe ——
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    processed_at INTEGER NOT NULL
  )`,

  // —— Pro: deadline reminders ——
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id TEXT NOT NULL DEFAULT '',
    deadline_text TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    remind_at INTEGER NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    channel TEXT NOT NULL DEFAULT 'email',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(user_id, sent, remind_at)`,

  // —— Pro: inbox (forwarded emails via Mailgun) ——
  `CREATE TABLE IF NOT EXISTS inbox_messages (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL DEFAULT '',
    sender TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    snippet TEXT NOT NULL DEFAULT '',
    received_at INTEGER NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    analysis_id TEXT NOT NULL DEFAULT '',
    analyzed INTEGER NOT NULL DEFAULT 0,
    replied INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, provider)`,

  // —— Pro: forward-to-TaskMind inbound routes ——
  `CREATE TABLE IF NOT EXISTS inbound_routes (
    slug TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,

  // —— Pro: priority support tickets ——
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    created_at INTEGER NOT NULL
  )`,

  // —— Pro: automation rules ——
  `CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition_json TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // —— Pro: tags on analyses / board items / templates ——
  `CREATE TABLE IF NOT EXISTS tags (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (user_id, target_type, target_id, tag)
  )`,

  // —— Analysis chat topics (persisted conversations, all signed-up users) ——
  `CREATE TABLE IF NOT EXISTS chat_topics (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    context_input TEXT NOT NULL DEFAULT '',
    context_analysis TEXT NOT NULL DEFAULT '{}',
    messages TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_topics_record ON chat_topics(user_id, record_id, updated_at)`,

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
