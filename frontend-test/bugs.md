# Bugs — confirmed defects

_Personas: Senior Developer + Frontend Tester_

Confirmed or near-confirmed defects found during the frontend pass. "Confirmed"
means reproduced at runtime, or provable from the code path with no intervening
handler. Each entry lists a suggested fix; none were applied (documentation pass).

> **Implementation status (2026-08-10): all of B1–B13 below were implemented
> and verified — full suite (128 tests), `tsc --noEmit`, ESLint (0 errors), and
> `next build` all pass. Every entry below is marked `— ✅ FIXED`; the fix
> applied is described in the relevant `frontend-test` document and cross-checked
> by the runtime smoke tests in `features.md`.**

---

## B1 — "End of the day" / "end of today" / "end of this month" parse to wrong dates — ✅ FIXED

- **Severity**: High
- **File**: `src/lib/deadline.ts` — `parseDeadline` (lines 74–89) / `parseFallback`
  (lines 147–154) / `applyTime` (lines 159–172)
- **How it works today**: `chrono.parseDate()` runs first and only falls back to
  the hand-rolled regexes when chrono returns `null`. For several "end of …"
  phrases chrono returns a **wrong** date instead of `null`, so the (correct)
  regex fallback is never reached.
- **Repro** (fixed "now" = Mon Aug 10 09:00, via `npx tsx`):

  | Input | Expected | Actual |
  | --- | --- | --- |
  | `"end of the day"` | Mon Aug 10 5:00 PM | **Tue Aug 11 9:00 AM** |
  | `"end of today"` | Mon Aug 10 5:00 PM | **Mon Aug 10 9:00 AM** |
  | `"end of this month"` | Aug 31 5:00 PM | **Aug 1 9:00 AM** |
  | `"end of day"`, `"EOD"`, `"cob"`, `"close of business"` | today 5:00 PM | today 5:00 PM ✅ (fallback works) |
  | `"end of month"` (no "this") | last day 5:00 PM | last day 5:00 PM ✅ |

- **Impact**: `sortDeadlines` (`deadline.ts:205`), `deadlineHorizon`
  (`src/lib/urgency.ts`), the `.ics`/calendar exports (`deadline.ts:225,245`) and
  the results panel all show a deadline a day late — or a month early — for
  common phrases like "submit by end of the day".
- **Suggested fix**: In `parseDeadline`, detect "end of (the )?(today|day)|EOD|close of business"
  and "end of (this |the )?month" *before* consulting chrono, or add a
  normalization step that rewrites these phrases to forms chrono handles. Keep
  the existing `parseFallback` cases (`deadline.ts:147,152`) as the second net.

---

## B2 — Cancelling an analysis shows a red error state — ✅ FIXED

- **Severity**: Medium
- **File**: `src/components/dashboard/DashboardHome.tsx` lines 84–87
- **Repro**: Start an analysis, click **Cancel** in `ResultsPanel`.
- **What happens**: `StreamCancelledError` is caught and routed into
  `setError(streamErr.message)` (line 86), which renders `ErrorState` with the
  red "Couldn't analyze that" alert (`DashboardHome.tsx:13–18`).
- **Why it's a bug**: Cancellation is user-initiated and expected — it shouldn't
  be presented as a failure. The `StreamCancelledError` type exists precisely to
  distinguish cancel from provider failure (see `src/lib/stream.ts:9`), but the
  dashboard ignores that intent.
- **Suggested fix**: Keep a separate `cancelled` state; when set, render a
  neutral inline notice ("Analysis cancelled") with a Retry button, not
  `ErrorState`. Reset it on the next `runAnalyze`.

---

## B3 — Ad slot never fills when the AdSense script hasn't loaded yet — ✅ FIXED

- **Severity**: Medium (revenue/placeholder; no data impact)
- **File**: `src/components/layout/AdsRail.tsx` lines 64–76 + `src/lib/ads.ts` `pushAd` lines 61–70
- **Repro**: With ad consent granted and `NEXT_PUBLIC_ADSENSE_CLIENT/SLOT` set,
  mount the page. `loadAdSenseScript()` (line 68) injects the script asynchronously,
  then `pushAd(ins)` runs after a fixed **120 ms** timeout (line 69–72). If
  `window.adsbygoogle` isn't defined yet, `pushAd` returns early (`ads.ts:64`)
  and the unit is never re-pushed — the slot stays empty indefinitely.
- **Note**: `pushAd` also swallows errors and dedupes per-unit via a WeakSet
  (`ads.ts:55,63`), so there is no retry path today.
- **Suggested fix**: Listen for the script's `load` event (or poll for
  `window.adsbygoogle`) before pushing; keep a "push attempted" flag so it
  happens once per unit; expose a manual refresh when consent changes instead of
  relying on the fixed timer.

---

## B4 — "Sponsored" label shown even when no ad renders — ✅ FIXED

- **Severity**: Medium (misleading content label)
- **File**: `src/components/layout/AdsRail.tsx` lines 78–82, rendered at line 86
- **Repro**: Without consent (or with no AdSense config), the placeholder slot
  ("Advertisement / Slot available") still carries a **"Sponsored"** label above it.
- **Why it's a problem**: Advertising disclosure labels should only appear next
  to actual ad content. A "slot available / remove ads with Pro" placeholder
  labeled "Sponsored" is inaccurate and could read as an endorsed link.
- **Suggested fix**: Render the label only in the `configReady && consented`
  branch (line 87); use neutral copy ("Ad slot" / none) for the placeholder.

---

## B5 — Escape clears text but leaves the file chip behind — ✅ FIXED

- **Severity**: Low
- **File**: `src/components/input/InputArea.tsx` lines 87–90 (Escape) vs. lines 49–64 (Clear button)
- **Repro**: Drop/upload a file, then press **Escape**. `onTextChange("")` runs
  but `fileName`, `fileSize`, and `fileStatus` are untouched — the filename chip
  (line 25) stays and the **Clear** button remains visible even though the
  textarea is empty.
- **Expected**: Escape should behave like the Clear button and reset all file
  state (and `fileInputRef.current.value`).
- **Suggested fix**: Extract the reset logic from the Clear handler into a shared
  `resetAll()` and call it from the Escape branch too.

---

## B6 — Route transition mounts children in a hidden `div`, running effects early — ✅ FIXED

- **Severity**: Medium (possible double work / hidden side effects)
- **File**: `src/components/navigation/RouteTransition.tsx` line 21
- **How it works**: During a skeleton transition the target page is rendered
  inside `<div hidden>{children}</div>`. `hidden` hides it visually, but React
  **mounts and runs effects**. For the dashboard this means `consumePendingTemplate()`
  (`DashboardHome.tsx:48–51`) and `TaskContext` hydration run while the page is
  hidden; a template auto-fill or any mount-triggered streaming could start
  invisible to the user.
- **Risk**: At minimum duplicate context/hydration work per navigation; worst
  case a hidden analysis kicks off before the user sees the page.
- **Suggested fix**: Don't render children until the transition resolves (keep
  the skeleton and only mount the real tree when ready), or gate child effects
  behind a `visible` flag. If hidden-mount is intentional for data warm-up,
  document it and ensure effects are idempotent.

---

## B7 — QuickSearch uses index-based keys and ARIA ids — ✅ FIXED

- **Severity**: Low
- **File**: `src/components/layout/QuickSearch.tsx` lines 33–34 (`key` + `id`), lines 68–70 (`aria-activedescendant`)
- **Problem**: `key={`${row.kind}-${index}`}` and `id={`qs-option-${index}`}`
  are index-based. The list is filtered/re-sorted on every keystroke, so rows
  shift positions. That causes (a) unnecessary React reconciliation and (b)
  `aria-activedescendant` pointing at a stale `id` for screen readers.
- **Also noted**: `li` lines 32–34 render `role="option"` with `aria-selected`
  but the interactive element is a nested `<button>` inside the `<li>` — an
  ARIA pattern mismatch (option rows should ideally be the activedescendant
  targets themselves).
- **Suggested fix**: Give each row a stable id from its data (`command.id`,
  `record.id`, `template.id`, `item.id`); consider using `aria-activedescendant`
  against those stable ids and simplifying the option markup.

---

## B8 — Latent regex-group bug in `parseFallback` "in N days" — ✅ FIXED

- **Severity**: Low (latent — masked by chrono today)
- **File**: `src/lib/deadline.ts` lines 48–54
- **The bug**: The alternation `\bsa loob ng (\d+)\s+(araw|days?)\b|\bin (\d+)\s+(days?|d)\b`
  captures the number into **group 1 for the Filipino branch** but **group 3 for
  the English branch**; the code reads `inDays[1]` (line 50). For English input
  `inDays[1]` is `undefined`, `Number(undefined)` is `NaN`, and `new Date(now +
  NaN)` is an **Invalid Date**.
- **Why latent**: `chrono.parseDate()` handles "in 3 days" correctly *before*
  the fallback runs, so the bad path is currently unreachable in normal use
  (verified at runtime: `parseDeadline("in 3 days")` → Thu Aug 13 9:00 AM ✅).
  It only becomes a visible bug if chrono ever misses such input — and
  `deadlineHorizon`, `sortDeadlines`, and `.ics` exports all depend on
  `parseDeadline`, so the blast radius is wide.
- **Suggested fix**: Use named capture groups and read the correct group, e.g.
  `(?:\bsa loob ng (?<days>\d+)\b|\bin (?<days>\d+)\b)`. Add a unit test in
  `tests/deadline.test.ts` that calls `parseFallback` directly for both languages.

---

## B9 — AuthForm detects "verify your email" by string-matching server copy — ✅ FIXED

- **Severity**: Low
- **File**: `src/components/auth/AuthForm.tsx` line 92; server message in `src/app/api/auth/login/route.ts`
- **Problem**: `msg.toLowerCase().includes("verify your email")` couples the UI
  to the API's English error string. A copy change in the route silently breaks
  the "Resend verification email" affordance (line 14–23).
- **Suggested fix**: Have the API return a machine-readable code (e.g.
  `code: "UNVERIFIED_EMAIL"`) and check that; keep the message for humans only.

---

## B10 — `applyTime` only understands `am`/`pm` — ✅ FIXED

- **Severity**: Low
- **File**: `src/lib/deadline.ts` lines 159–172 (regex at 160–161)
- **Repro**: `parseDeadline("meet at 18:00")` — chrono returns a date but no
  24-hour time is applied; results show a 9 AM default instead of 6 PM.
- **Suggested fix**: Extend the regex to `\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b`
  plus a bare 24h branch (`\b([01]?\d|2[0-3]):[0-5]\d\b`), applying the hour
  directly when no meridiem is present.

---

## Backlog (tracked, not confirmed defects) — ✅ all resolved

| ID | Observation | File | Why it's only a note | Status |
| --- | --- | --- | --- | --- |
| B11 | `UrgencyMeter` would crash (`URGENCY_LEVELS[-1]`) on an unrecognized level | `src/components/results/UrgencyMeter.tsx:11–12` | Validation clamps levels upstream, so unreachable today; worth a guard | ✅ FIXED — added guard, falls back to the last level |
| B12 | Sidebar shows three routes to `/settings` (nav item, "Preferences", bottom "Settings") | `src/components/layout/Sidebar.tsx:8,96,138` | Redundant, not broken | ✅ FIXED — removed redundant "Preferences" and bottom "Settings" entries |
| B13 | `cleanText` strips non-ASCII (`/[^\x20-\x7E]/g`) — accents in Filipino/Spanish lost | `src/lib/analyzeRules.ts:38` | Data quality issue for non-English input | ✅ FIXED — now preserves Latin-1 / Latin Extended letters |
