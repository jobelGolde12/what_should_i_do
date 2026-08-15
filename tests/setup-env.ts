/**
 * Test-environment hermeticity.
 *
 * Vitest loads the project's `.env`/`.env.local` (dev credentials) into
 * `process.env`, which leaks real config into tests that assert documented
 * defaults. Strip the ones tests rely on being absent:
 *
 * - `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` → tests must use the local SQLite
 *   fallback (`src/lib/db`) so the suite is headless and fast, not the remote
 *   database.
 * - `MAILGUN_BASE_URL` → tests assert the default `api.mailgun.com` endpoint.
 * - `NEXT_PUBLIC_APP_URL` → tests assert the default `taskmind.app` fallback.
 *
 * Tests that need a specific value set it themselves (and restore it) inside
 * their own `beforeEach`/`try-finally` blocks.
 */
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.MAILGUN_BASE_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
