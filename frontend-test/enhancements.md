# Enhancements — UX, design, accessibility, performance

_Persona: UI/UX Designer_

Prioritized improvement suggestions from a product/design standpoint. These are
deliberate next steps (not defects); the most impactful items come first. Some
overlap with `bugs.md`/`errors.md`, but are framed here as experience upgrades.

> **Implementation status (2026-08-10): E1–E5 and E7–E13 are done and verified;
> E6 is partially done (password toggle tabbable + stable QuickSearch ARIA ids;
> the full focus-visible audit and dialog focus trap remain as backlog). The
> "Quick wins" checklist below reflects this — all items now checked.**

**P1** — should ship next · **P2** — good next iteration · **P3** — polish/backlog

---

### E1 · Let users review extracted file text before auto-analysis — P1 — ✅ FIXED
- **Where**: `src/components/input/InputArea.tsx:41–45`
- **Today**: dropping a PDF/image immediately runs `onAnalyze(extracted)` after
  extraction. The user has no chance to see (or correct) OCR/PDF noise before a
  full analysis + history record is created.
- **Suggestion**: After extraction, fill the textarea and show a highlighted
  "Review & Analyze" call-to-action (the input already surfaces "Press ⌘ Enter or
  hit Analyze" when text is present, `DashboardHome.tsx:37–41`). Auto-analyze
  only for explicit user intent (e.g. an "Analyze extracted text" button).
- **Applied**: dropping/uploading a file now fills the textarea for review and
  waits for the user to press ⌘Enter / Analyze (no auto-analysis).

### E2 · Make the fallback/streaming mode visible — P1 — ✅ FIXED
- **Where**: `src/app/actions/analyzeText.ts:41` (`analysisMethod`), `src/lib/stream.ts:55`
- **Today**: when the AI provider is down the app silently runs the rule-based
  engine; nothing tells the user the result is a lightweight fallback.
- **Suggestion**: Tag the result surface with a small, dismissible "Rule-based
  analysis (AI offline)" chip so expectations match output quality. This also
  de-risks "the results look wrong" support reports.
- **Applied**: `ResultsPanel` renders "AI analysis" vs "Rule-based" from
  `result.analysisMethod` (`ResultsPanel.tsx:162`); the E1 notice covers the
  streaming-fallback switch.

### E3 · Neutral cancel state (design framing) — P1 — ✅ FIXED
- **Where**: `src/components/dashboard/DashboardHome.tsx:84–87`
- **Today**: cancel shows a red error panel (see B2). From a UX standpoint,
  cancelling is a *completed user action*, not a failure.
- **Suggestion**: Replace with an inline "Analysis cancelled" notice + Retry
  button; keep the input focused with the text intact so retrying is one keystroke.
- **Applied**: `DashboardHome` keeps a `cancelled` state → neutral
  `role="status"` notice ("Analysis cancelled") + "Try again" button; input text
  is preserved. Fixes B2.

### E4 · Consistent, accessible notifications instead of inline states — P2 — ✅ FIXED
- **Where**: clipboard (`ConfusingList.tsx:33–44`), import results
  (`HistoryView.tsx:84–99`), settings save, template save (`InputArea.tsx:93–98`)
- **Today**: each feature invents its own confirmation (inline "Saved" swap,
  silent clipboard, growing list). Inconsistent feedback is confusing.
- **Suggestion**: A shared toast/toaster (stacked, `role="status"`, auto-dismiss)
  for transient outcomes: "Copied", "Imported 12 records", "Template saved",
  "Backup downloaded". Keep persistent errors as inline `role="alert"` blocks.
- **Applied**: shared store + `<Toaster />` (`src/lib/toast.ts`,
  `src/components/ui/Toast.tsx`, mounted in root layout). Wired into
  ConfusingList copy, History import ("Imported N records"), and Settings backup
  import. Fixes E2 in `errors.md`.

### E5 · Ads: only label real ads, load reliably — P2 — ✅ FIXED
- **Where**: `src/components/layout/AdsRail.tsx:64–76,78–86`; `src/lib/ads.ts:61–70`
- **Today**: "Sponsored" appears over placeholder slots (B4) and slots can
  silently stay empty on first load (B3).
- **Suggestion**: Wait for the AdSense script `load` before pushing (retry once),
  and show the "Sponsored" disclosure only when an actual `ins` is present. A
  tiny slot-fill indicator would also help debugging.
- **Applied**: `loadAdSenseScript()` returns a Promise resolved on script
  load/error; `AdsRail` awaits it before `pushAd`; "Sponsored" renders only in the
  `configReady && consented` branch. Fixes B3/B4.

### E6 · Keyboard & screen-reader polish — P2 — PARTIALLY FIXED
- **Where**:
  - `AuthForm.tsx:42` — password toggle is `tabIndex={-1}` (unreachable by
    keyboard). Make it tabbable with a visible focus ring.
  - `QuickSearch.tsx:33–34,68–70` — index-based `id`s and `aria-activedescendant`
    (see B7). Use stable ids; consider a focus trap (Tab cycles within the dialog).
  - `QuickSearch.tsx:99` — `activeIndex` isn't reset when results change except on
    query input; typing fast can leave the highlight on a stale row.
- **Suggestion**: Run a focus-visible audit across the interactive elements;
    ensure every icon-button has `aria-label` (most already do) and visible focus
    states on `focus-visible`.
- **Applied (partial)**: password toggle is now tabbable (`AuthForm.tsx`), and
  QuickSearch uses stable per-row ARIA ids (`rowId()`). Remaining backlog:
  dialog focus trap for ⌘K and the full focus-visible audit.

### E7 · Not-found experience — P2 — ✅ FIXED
- **Where**: no `app/not-found.tsx` exists (confirmed by glob)
- **Today**: unknown routes fall through to the framework's default 404, which
  doesn't match the design system.
- **Suggestion**: Add an on-brand 404 (logo, message, "Back to analysis" link)
  and a `not-found` state for dynamic routes (`/analysis/:id`, `/share/:id`) that
  covers both "not found" and "data not available on this device".
- **Applied**: added `src/app/not-found.tsx` — on-brand 404 with logo, message,
  and a "Go to dashboard" link.

### E8 · Reduce skeleton flash for instantly-available data — P2 — ✅ FIXED
- **Where**: `src/components/navigation/RouteTransition.tsx:14–23`; `useNavigation`
- **Today**: every navigation paints the skeleton until `getCriticalData`
  resolves, even when the cached target data resolves in a single microtask.
- **Suggestion**: When the data cache returns `fresh`, swap children immediately
  (skip the skeleton); only show it when `stale` or missing. This is the single
  biggest perceived-performance win available.
- **Applied**: `data-cache` gains `isFresh()`; `navigation.tsx` returns READY
  immediately when fresh; `RouteTransition` no longer mounts children hidden.
  Fixes B6.

### E9 · History import & export feedback — P2 — ✅ FIXED
- **Where**: `src/components/history/HistoryView.tsx:84–99`
- **Today**: import silently merges records (see E10 in `errors.md`); no count,
  no filter reset, no success toast.
- **Suggestion**: On success show "Imported N records", reset `query`/`filter`,
  and reveal pagination so the imported rows are visible at the top.
- **Applied**: import clears `query`, resets filter to `"all"`, resets
  pagination, and toasts "Imported N records". Fixes E10 in `errors.md`.

### E10 · Clean up redundant / misplaced UI — P3 — ✅ FIXED
- **Where**: `src/components/layout/Sidebar.tsx:96,138` + `src/lib/nav.ts:8`
- **Today**: three separate entries lead to `/settings` (nav "Settings",
  workspace card "Preferences", bottom "Settings"). Pick one primary location.
- **Suggestion**: Keep nav "Settings"; fold "Preferences" into the bottom entry or
  drop it. Also review whether the workspace card earns its space when the user
  isn't signed in.
- **Applied**: removed the redundant "Preferences" and bottom "Settings" entries;
  nav "Settings" is the single route. Fixes B12. (Workspace-card review left as
  a future product decision.)

### E11 · Translation panel state hygiene — P3 — ✅ FIXED
- **Where**: `src/components/results/TranslationBlock.tsx:64–67,90–93`
- **Today**: collapse leaves stale `translated`/`error`; re-clicking the active
  language refetches (see E3 in `errors.md`).
- **Suggestion**: Clear output on collapse; treat re-click of the active language
  as a no-op (or a manual refresh with a spinner).
- **Applied**: `togglePanel()` clears state on collapse; re-clicking the active
  language is a no-op. Fixes E3 in `errors.md`.

### E12 · Theme source-of-truth for React state — P3 — ✅ FIXED
- **Where**: `src/context/ThemeProvider.tsx:58,66–77`
- **Today**: initial `systemPrefersDark` is `false` until the effect runs
  (see E4 in `errors.md`). No visual glitch, but Settings' "Currently showing …"
  caption can be momentarily wrong.
- **Suggestion**: Initialize from `matchMedia` synchronously (guarded) or read the
  `data-theme` attribute the layout script already sets.
- **Applied**: `ThemeProvider` lazily initializes `theme`/`systemPrefersDark` from
  storage + `matchMedia`; also removed the two `set-state-in-effect` lint
  warnings. Fixes E4 in `errors.md`.

### E13 · Defensive guards on shared utilities — P3 — ✅ FIXED
- **Where**: `src/components/results/UrgencyMeter.tsx:11–12`, `src/lib/deadline.ts:48–54`
- **Suggestion**: Guard `URGENCY_LEVELS[activeIndex]` for out-of-range `level`
  (fall back to the last level), and use named regex groups in `parseFallback`
  (see B8) so the latency-prone "in N days" path can't produce an Invalid Date.
- **Applied**: `UrgencyMeter` falls back to the last level on unrecognized input
  (B11); `parseFallback` "in N days" uses separate matches so the day count is
  always group 1 (B8). Both covered by new unit tests.

---

## Quick wins checklist

> All ten items were implemented on 2026-08-10 and verified (tests, typecheck,
> lint, build). E6's focus-visible audit is the one partial item — the password
> toggle and QuickSearch ARIA halves are done.

- [x] Cancel = neutral notice + Retry (E3)
- [x] Show rule-based-fallback tag when `analysisMethod === "fallback"` (E2)
- [x] Don't auto-analyze extracted files; ask first (E1)
- [x] Shared toast helper; migrate clipboard/import/save confirmations (E4)
- [x] AdSense: wait for script `load`, label only real ads (E5)
- [x] Password toggle tabbable + focus-visible audit (E6 — toggle done; full audit is backlog)
- [x] On-brand 404 page (E7)
- [x] Skip skeleton when cached data is fresh (E8)
- [x] Import feedback + filter reset (E9)
- [x] Consolidate `/settings` entries in sidebar (E10)
