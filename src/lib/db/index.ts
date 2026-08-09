/**
 * Turso (libSQL) database accessor.
 *
 * The client is lazily created once and cached. Resolution order for the
 * connection URL:
 *   1. `TURSO_DATABASE_URL` (required in production) — a `libsql://` remote.
 *   2. A local SQLite file (`file:.data/taskmind.db`) for dev/tests when no
 *      remote URL is configured. This keeps the app functional without network
 *      access and makes the test-suite headless.
 *
 * `ensureSchema()` applies the idempotent DDL + bumps `schema_migrations` and
 * is called lazily by every repository method, so callers never need to worry
 * about ordering.
 */
import type { TursoClient } from "./types";
import { createClient } from "@libsql/client";
import { SCHEMA_DDL, SCHEMA_VERSION } from "./schema";

let client: TursoClient | null = null;
let schemaReady = false;

function defaultLocalUrl(): string {
  return `file:${process.cwd()}/.data/taskmind.db`;
}

/**
 * Creates (or returns the cached) libSQL client. In production the absence of a
 * Turso URL is a fatal configuration error; in dev/test we transparently fall
 * back to a local file.
 */
export function getDb(): TursoClient {
  if (client) return client;

  const isProd = process.env.NODE_ENV === "production";
  const url = process.env.TURSO_DATABASE_URL?.trim() || "";
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || "";

  if (!url) {
    if (isProd) {
      // Fail fast with an explicit, actionable message.
      throw new Error(
        "[db] TURSO_DATABASE_URL is not set. A Turso database is required in production."
      );
    }
    // Dev/test: use a local SQLite file.
    const local = defaultLocalUrl();
    client = createClient({ url: local });
    return client;
  }

  client = createClient({ url, authToken: authToken || undefined });
  return client;
}

/** Returns `true` when a remote Turso URL is configured. */
export function isRemoteDb(): boolean {
  const url = process.env.TURSO_DATABASE_URL?.trim() || "";
  return url.startsWith("libsql://") || url.startsWith("libsql+web://");
}

/** Resets the cached client + schema flag. Intended for tests. */
export function resetDbCache(): void {
  if (client) {
    try {
      client.close();
    } catch {
      /* best-effort */
    }
  }
  client = null;
  schemaReady = false;
}

/**
 * Applies the schema DDL if it has not been applied to the current client.
 * Safe to call many times: it's a no-op after the first successful run.
 * Tests can `resetDbCache()` to force a re-run against a fresh file.
 */
export async function ensureSchema(): Promise<void> {
  const db = getDb();
  if (schemaReady) return;
  // Each DDL string may contain multiple statements; libSQL accepts them.
  for (const ddl of SCHEMA_DDL) {
    await db.execute(ddl);
  }
  // Record/apply schema version.
  try {
    await db.execute(
      "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      [SCHEMA_VERSION, Date.now()]
    );
  } catch {
    /* schema_migrations may not exist on a partially-migrated DB; the DDL above
       already created it, so a second pass is unnecessary in practice. */
  }
  schemaReady = true;
}

/** Returns the applied `schema_migrations` version, or `0` if unmigrated. */
export async function getSchemaVersion(): Promise<number> {
  const db = getDb();
  try {
    const res = await db.execute(
      "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1"
    );
    if (res.rows?.length) return Number(res.rows[0].version ?? 0);
  } catch {
    /* table may not exist yet */
  }
  return 0;
}

/** Best-effort connectivity check used by health/startup validation. */
export async function pingDb(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Fails fast in production when required DB credentials are missing. In dev/test
 * this is a no-op (the local-file fallback handles it).
 */
export function validateDbConfig(): void {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.TURSO_DATABASE_URL) {
    throw new Error(
      "[db] TURSO_DATABASE_URL is required in production. Set it (and " +
        "TURSO_AUTH_TOKEN) before starting the server."
    );
  }
}
