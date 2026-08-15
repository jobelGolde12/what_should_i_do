# Responsiveness & UI Review — TaskMind

**Date:** 2026-08-15
**Method:** Static review of layout/responsive classes across all views (read-only). Functional findings verified in source; visual rendering requires a browser (flagged).

---

## 1. Findings

### C1 — High — Billing page mostly unstyled (undefined Tailwind tokens)
- **Location:** `src/app/(workspace)/settings/billing/page.tsx`
- `border-border`, `bg-card`, `bg-primary`, `text-primary`, `ring-primary` are used throughout (`:115,133-135,166-169,207,215-218,234-252,279,296,304,319`) but the `@theme` block (`globals.css:82-114`) defines **no** `--color-border / --color-card / --color-primary`. In Tailwind v4 these compile to nothing.
- **Effect:** Plan cards lose borders, the current-plan badge/indicator is invisible, the focus ring never renders (compounds accessibility finding A8). Users on the billing page cannot tell which plan they are on.
- **Fix:** Add the color tokens or replace with existing `--accent`-based utilities.

### C2 — Medium — Dead font config
- `tailwind.config.js:14-17` maps `fontFamily.sans/mono` to `var(--font-geist-*)`, which are never defined; real fonts come from CSS `@theme` (`globals.css:103-105`). `font-sans` silently falls back. Remove the stale config.

### C3 — Medium — "Loading your address…" persists forever on failure
- `src/components/inbox/InboxView.tsx:63-78` — `load()` sets state only on success; `:138` renders "Loading your address…" indefinitely if the forward-address request fails. No error branch.

### C4 — Medium — Inconsistent destructive-action confirmation
- Multi-item/bulk ops use `window.confirm` (`HistoryView.tsx:176`, `SettingsView.tsx:145,156,270,301`), but single-item deletes run silently with no confirm and no undo: `SavedView.tsx:199` (deleteTemplate), `HistoryView.tsx:269` (deleteAnalysis). Irreversible data loss with no confirmation.

### C5 — Medium — BottomNav label legibility at narrow widths
- `src/components/layout/BottomNav.tsx:16,25-27` — 6-column grid with 10px (`text-xxs`) labels; at 320 px "History"/"Settings" render around 9 px. Touch targets are around 44 px (borderline). `aria-current="page"` present (good).

### C6 — Low — QuickSearch dropdown on short viewports
- `QuickSearch.tsx:290,337` — `max-h-96` can overflow short screens; no inner-scroll affordance is communicated to screen readers.

### C7 — Low — Forward-address overflow
- `InboxView.tsx:120` — long `<code>` email rendered without `break-all`/`min-w-0`, risks horizontal scroll on mobile.

## 2. Responsive layout review (static)

| Concern | Verdict |
|---|---|
| Breakpoint usage (Tailwind sm/md/lg) | Consistent; sidebar ↔ bottom-nav swap is standard |
| Landing page mobile structure | Column layout; heavy first-load (146 kB) on slow connections is the main mobile concern |
| Workspace views (inbox, history, saved, actions, settings) | Column stacking with readable hierarchy; micro-font risks flagged in C5/A11 |
| Touch targets | BottomNav and small icon buttons hover around the 44 px guideline |
| Horizontal overflow risks | Inbox forward address (C7); otherwise no obvious fixed-width offenders |
| Long text / analysis output | Uses `break-words` patterns in results views; OK |

## 3. Needs browser verification
- C1 rendering (DevTools CSS output for `border-border`/`bg-card`/`ring-primary`).
- Actual rendered font (Inter via CSS `@theme`, not the dead Geist refs).
- BottomNav/touch-target sizes at 320/375 px.
- ActionsBoard touch drag-and-drop.
- `scrollIntoView` jump during streaming analysis (DashboardHome).
- `window.confirm` behavior inside embedded webviews (cross-origin suppression).

## 4. Priority fixes
1. Billing page tokens (C1) — invisible plan UI.
2. Inbox loading error branch (C3).
3. Single-item delete confirmation/undo (C4).
4. BottomNav label sizing (C5).
