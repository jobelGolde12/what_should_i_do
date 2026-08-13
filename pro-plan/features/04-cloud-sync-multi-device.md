# Pro Plan — 04 · Cloud Sync & Multi-Device

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Today all data (history, board, templates, settings) lives in `localStorage`
(`src/context/TaskContext.tsx`). Free accounts can push/pull an **opaque blob**
via `/api/users/me`. Pro gets **structured, reliable sync**: the same history,
board, templates, and settings available on every device, with cloud backup and
restore.

## Where it fits today

- `src/lib/db/schema.ts` already defines normalized tables: `analyses`,
  `board_items`, `templates`, `user_settings` — but `/api/users/me` still stores
  one opaque `data` JSON blob (see `src/context/AuthContext.tsx` `pushData`/
  `pullData`).
- Auth exists (email/password + sessions). No sync engine, no conflict
  resolution, no backup UI.

## Depends on

- `00-entitlements-and-gating.md` (Pro-only sync)
- Existing auth + `/api/users/me` plumbing

---

## Tasks

### 1. Structured sync storage

- [x] Rewrite `PUT/GET /api/users/me` to persist into the normalized tables
  (`analyses`, `board_items`, `templates`, `user_settings`) instead of the opaque
  blob; keep the API shape (`AuthData`) for compatibility.
- [x] Add `updated_at`/`deleted_at` per record (schema bump to v3) to support
  incremental sync + tombstones.
- [x] Ensure writes are transactional (all-or-nothing per push).

### 2. Sync engine

- [x] Create `src/lib/sync.ts`: on login and on navigation focus, `pullData()`
  merges server records into local state; on every local change, a debounced
  (e.g. 2 s) `pushData()` sends only records changed since `lastSyncedAt`.
- [x] Conflict resolution: last-write-wins per record using `updated_at`; local
  wins within the same second (keeps edits on the active device).
- [x] Idempotent pushes (record id + version) so retries never duplicate.

### 3. Backup & restore

- [x] Add "Back up now" (push full snapshot) and "Restore from backup" (pull and
  replace, with confirm dialog) in `SettingsView.tsx`.
- [x] Show last-synced timestamp and per-device count; a "Sync error" state with
  retry (toast via `src/lib/toast.ts`).

### 4. Offline behavior

- [x] Queue local changes while offline and flush on reconnect (reuse the
  storage-error / offline banner pattern in `HistoryView`).
- [x] Never block local use on sync failure (local-first stays the source of
  truth until a push succeeds).

### 5. Tests

- [x] Unit: `tests/sync.test.ts` — merge/conflict rules, debounce, tombstone
  handling, idempotent push.
- [x] Route tests: auth required, validation, transactional write, replace vs
  merge semantics.

## Definition of done

- [x] A Pro user's history/board/templates/settings are identical across two
  browsers/devices after a login + pull, and edits on either device converge.
- [x] Backup/restore works and offline edits sync when back online.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
