# Feature 14 — Quick Search (⌘K)

## 1. What it is & its role

The **Quick Search** feature is a global command/search palette opened with **⌘/Ctrl + K**. It searches the user's history and saved templates and lets them jump to an analysis or apply a template. Its role is fast navigation and retrieval across local data.

## 2. Current functionality

### Where it lives
- **UI:** `src/components/layout/QuickSearch.tsx` (mounted in `DashboardLayout.tsx`).
- **Data source:** `src/context/TaskContext.tsx` → `history` and `templates`.

### How it works today
1. `⌘/Ctrl + K` toggles the palette; `Esc` closes it.
2. Focus auto-moves to the input.
3. Results are computed via `useMemo` from history (by input/nextStep) and templates (by name/content), limited to 5 each.
4. Selecting a history result routes to `/analysis/[id]`.
5. Selecting a template routes to `/` and dispatches `taskmind:apply-template`.

### Current limitations
- **Local-only** scope — cannot search server data, actions board, docs, or web.
- No **keyboard navigation** beyond open/close (no arrow keys to move through results, no Enter selection).
- **No recent/quick actions** (e.g., "New analysis", "Go to Settings").
- No fuzzy/robust matching (simple substring includes).
- No empty-state command hints or result counts.
- Template apply relies on the fragile event/setTimeout flow (see Feature 13).
- No mobile equivalent (⌘K is desktop-only).

## 3. Future enhancements (production-ready Quick Search)

### 3.1 Command palette actions
- Add **commands** (New Analysis, My Actions, History, Saved, Settings, toggle theme) in addition to search results.

### 3.2 Keyboard navigation
- Add arrow-key navigation, Enter to select, and `aria-activedescendant` for accessibility.

### 3.3 Broader & smarter search
- Include **actions board**, shareable results, and (when backend exists) **server data**.
- Fuzzy matching / score-based ranking.

### 3.4 Robust apply flow
- Refactor template application to shared state instead of the event/setTimeout indirection.

### 3.5 Mobile / touch
- Add a mobile search entry point (e.g., icon in the top bar).

### 3.6 Testing
- Unit tests for the filtering/search logic.
- E2E tests for open, type, navigate, and select flows.

> **Status: DONE** — Implemented in this round: command-palette actions (New Analysis, My Actions, History, Saved, Settings); full keyboard navigation (↑↓ to move, Enter to select, `aria-activedescendant`/`role="listbox"`/`role="option"`); broader search including the actions board; score-based ranking (`scoreMatch`: exact → prefix → word hits → substring); robust template apply reuses the F13 `storePendingTemplate` flow; mobile entry point via a search icon in the mobile header dispatching `taskmind:open-search` and an `sm`-visible `⌘ K to search` hint.

> **Definition of "done" for this feature:** ⌘K palette is a full command palette with keyboard nav, broad+fuzzy search, mobile entry, robust template apply, and is tested.
