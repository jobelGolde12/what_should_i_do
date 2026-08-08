# Feature 11 — History Management

> **Status: DONE** — Added JSON export/import of history (via `src/lib/backup.ts` + `importHistory` in TaskContext, which also rebuilds board items and dedupes by id). `writeStorage` now dispatches `taskmind:storage-error` on quota failure so HistoryView shows a "storage full" banner with a one-click backup download. HistoryView paginates 25 at a time with "Show more".

## 1. What it is & its role

The **History Management** feature stores past analyses and lets users search, filter, reopen, and delete them. Its role is to provide a persistent, searchable record of everything the user has analyzed so they can revisit decisions and actions.

## 2. Current functionality

### Where it lives
- **State:** `src/context/TaskContext.tsx` → `history: AnalysisRecord[]`, `saveAnalysis`, `deleteAnalysis`, `clearHistory`, `loadRecord`.
- **Persistence:** `src/lib/storage.ts` → `localStorage` key `taskmind:history`.
- **UI:** `src/components/history/HistoryView.tsx` + route `src/app/history/page.tsx`.
- **Detail page:** `src/components/analysis/AnalysisView.tsx` + route `src/app/analysis/[id]/page.tsx`.

### How it works today
1. On each successful analysis, `saveAnalysis` prepends an `AnalysisRecord { id, timestamp, input, output }` to history.
2. `HistoryView` lists records with urgency badges, relative timestamps, action/deadline counts, and a snippet.
3. Users can **search** (by input/nextStep), **filter** by urgency, **open** a record, and **delete** individual records or **clear all**.
4. Records persist in `localStorage` and hydrate on mount.

### Current limitations
- **localStorage only** — data is lost on a different device/browser, and there's no sync or backup.
- **No export/import** of history.
- **No pagination** — long histories render all rows (performance risk).
- **No server-side persistence** or multi-device sync (no auth).
- IDs are random; no human-readable reference.
- No batch delete/select.
- localStorage quota (~5 MB) can be exceeded with long records — writes fail silently (`writeStorage` swallows errors).

## 3. Future enhancements (production-ready History Management)

### 3.1 Backend persistence & sync
- Store history in a database (Postgres/Supabase) tied to a user account (Feature 19).
- Add **sync** across devices with conflict resolution and offline-first queue.

### 3.2 Export & import
- Export history to **JSON/CSV/Markdown**.
- Import from JSON backup.

### 3.3 Performance & UX
- Add **pagination** or virtualized list.
- Add **batch select/delete** and **favorites/pinning**.
- Add grouping by day/month.

### 3.4 Data safety
- Handle storage quota errors with a clear message and a "download backup" prompt.
- Add limits on stored record size/count with pruning options.

### 3.5 Testing
- Unit tests for save/delete/clear/filter logic.
- E2E tests for search, filter, open, and delete flows.

> **Definition of "done" for this feature:** History persists to a backend, syncs across devices, supports export/import, paginates, and is fully tested.
