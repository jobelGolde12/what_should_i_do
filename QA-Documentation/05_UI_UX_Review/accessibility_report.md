# Accessibility Report (WCAG 2.x) — TaskMind

**Date:** 2026-08-15
**Method:** Static audit of all client components and pages (read-only). Findings are code-verified with file:line references. Items needing a browser are flagged in §3.

Severity: **Critical** (Level A failure / serious barrier), **High** (common-user barrier), **Medium** (barrier for some), **Low** (polish).

---

## 1. Findings

### A1 — Critical — No skip-to-content link (WCAG 2.4.1 Bypass Blocks, Level A)
- `src/app/layout.tsx:90-108` (DashboardLayout) + `src/components/layout/DashboardLayout.tsx:62` (`<main>` without `id`).
- No skip link anywhere in the app. Keyboard users must tab through the full sidebar (7 nav items, plan card, user card) on every page load.

### A2 — High — `role="option"` items contain tabbable buttons (WCAG 4.1.2)
- `src/components/layout/QuickSearch.tsx:385-412` — each `<li role="option">` wraps a `<button>`; arrow-key selection desyncs from Tab focus, and screen readers announce a nested-button listbox option.
- Pattern fix: focusable `<li role="option">` or `<button role="option">` without nesting.

### A3 — High — Chatty `aria-live` region around token-streamed output (WCAG 4.1.3)
- `src/components/results/ResultsPanel.tsx:217-221` — `aria-live="polite"` on a container re-rendered per streaming chunk; SRs announce dozens of partial sentences per answer. Prefer announcing a "ready" status when the stream completes.

### A4 — High — Dark-theme accent-on-accent-soft text fails 4.5:1 (WCAG 1.4.3 AA)
- `src/app/globals.css:46,69` (`--accent-soft: rgba(200,16,46,0.16)` over `--surface:#1c1c1b`) with `--accent:#ea5068` text ≈ **4.4:1** (fails). Used by `Badge.tsx:11` (accent tone), `ResultsPanel.tsx:171-183` (Resolved badge), `ReplyPanel.tsx:243` (draft chip). Computed ratio — confirm in browser.

### A5 — Medium — Login form `minLength={8}` blocks valid shorter passwords (WCAG 3.3.1/3.3.3)
- `src/components/auth/AuthForm.tsx:252,257` — HTML5 validation prevents sign-in for legacy accounts with 4–7 char passwords; also an SR/UX trap.

### A6 — Medium — Status changes not announced (WCAG 4.1.3)
- `src/components/layout/UnverifiedBanner.tsx:43-48` (resend confirmation) and `src/components/inbox/InboxView.tsx:160-210` (new message list swap) have no live region.

### A7 — Medium — `tabIndex` on a non-interactive element (WCAG 2.4.3 / 4.1.2)
- `src/components/results/ReplyPanel.tsx:227-231` — `tabIndex={open ? 0 : undefined}` on a plain `<div>` with no role → dead tab stop.

### A8 — Medium — Focus-visible ring suppressed / non-rendering (WCAG 2.4.7)
- `src/components/auth/AuthForm.tsx:263` — `focus:outline-none` on password toggle.
- `src/app/(workspace)/settings/billing/page.tsx:293` — `focus-visible:ring-primary/50`; `ring-primary` generates no CSS (undefined token, see UX C1), so no ring renders. Only the unlayered rescue at `globals.css:136-139` provides any indicator.

### A9 — Medium — Focus not moved after actions (WCAG 2.4.3 / 2.4.7)
- `src/components/dashboard/DashboardHome.tsx:87-90` — after "Analyze", only `scrollIntoView` is called; keyboard/SR users get no focus target or announcement (compounds A3).

### A10 — Medium — Placeholder-as-label pattern (WCAG 1.3.1 / 3.3.2)
- `src/components/input/InputArea.tsx:351-353`, `QuickSearch.tsx:313-314`, `InboxView.tsx:150-152`, `SavedView.tsx:87,94,129-130` — placeholder + `aria-label` with no visible label. `ShareDialog.tsx:214` does it correctly with a real `<label>`; `AuthForm` wraps fields in `<label>` (good).

### A11 — Low — Micro font sizes (WCAG 1.4.4 legibility)
- `globals.css:107-108` — `--text-xxs: 0.625rem` (10px), `--text-2xs: 0.6875rem` (11px) used in 65+ places (`BottomNav.tsx:25`, `ResultsPanel.tsx:53`, `Badge.tsx:25`, `HistoryView.tsx:244-249`, `SavedView.tsx:158`, literal `text-[10px]` at `States.tsx:33`).

### A12 — Low — Muted text contrast borderline in light mode (WCAG 1.4.3)
- `--muted:#6b6b6b` on `--surface:#f7f7f5` ≈ 4.95:1 (pass), on `--surface-2:#efefec` ≈ 4.6:1 (pass, thin margin). Dark mode ≈ 6.7:1 (safe).

### A13 — Low — Ad placeholder exposed to assistive tech (WCAG 1.3.1)
- `src/components/layout/AdsRail.tsx:108-117` — "Advertisement / Slot available / Remove ads with Pro" rendered as text; should be `aria-hidden` until a real ad renders.

### A14 — Low — `title` on `aria-hidden` decorative bars (WCAG 1.3.1)
- `src/components/results/UrgencyMeter.tsx:19-26` — info dropped for SR but present for pointer users.

### A15 — Low — Presentation backdrop with click handler (WCAG 2.1.1)
- `QuickSearch.tsx:289-293` — `role="presentation"` div with `onClick`; mitigated by Escape + close button.

### A16 — Low — Drag-and-drop not keyboard-operable (WCAG 2.1.1 / 2.5.7)
- `src/components/board/ActionsBoard.tsx:57-64` — plain `draggable` divs; keyboard alternative exists via move buttons (`:95-112`, good).

### A17 — Low — QuickSearch modal lacks `role="dialog"` (WCAG 4.1.2)
- `QuickSearch.tsx:294-343` traps focus + Escape but no `role="dialog"`/`aria-modal`; `ShareDialog` does it correctly.

### A18 — Info — Shortcut hints hidden on small screens / not announced
- `InputArea.tsx:468`, `ReplyPanel.tsx:310`, `QuickSearch.tsx:324` — `kbd` hints `hidden sm:inline`.

### A19 — Info — Positive pattern
- `RouteTransition.tsx:19` sets `aria-busy`; `RouteSkeletons.tsx` skeletons are `aria-hidden` — correct.

## 2. Positives (verified)

- Proper landmarks: `<main>`, labeled navs (`Sidebar.tsx:29`, `BottomNav.tsx:13`), footer; `lang="en"`.
- Real `<label>` on AuthForm (`AuthForm.tsx:219-232`) and ShareDialog (`ShareDialog.tsx:214`); most icon buttons have `aria-label`.
- Correct focus styles where tokens exist: `Button.tsx:8`, `ActionList.tsx:62` (`focus-visible:outline-2`), plus a global `:focus-visible` rescue (`globals.css:136-139`).
- Solid ARIA patterns: Toast `role="status"`+live, ShareDialog dialog+focus trap+restore, QuickSearch combobox/listbox with arrow nav, ActionList `role="checkbox"`, filters `aria-pressed`.
- Live regions in the right places: ReplyPanel draft, TranslationBlock, States `role="status"/"alert"`.
- `prefers-reduced-motion` respected; no-JS guard; decorative images `aria-hidden`.
- Client-side security hygiene (see security audit): zero XSS sinks, `rel="noopener noreferrer"` everywhere `target="_blank"` is used.

## 3. Needs browser verification
- Contrast ratios A4/A12 (composited accent-soft over both themes).
- `aria-live` streaming verbosity with real SR (VoiceOver/NVDA).
- Focus-trap integrity of QuickSearch/ShareDialog across browsers.
- `scrollIntoView` page-jump during streaming (DashboardHome).
- `minLength={8}` blocking real accounts (HTML5 behavior) + autofill interaction.
- Billing page token rendering (C1) in DevTools.
- Touch drag-and-drop on ActionsBoard; BottomNav touch-target size at 320/375 px.

## 4. Priority fixes
1. Skip link (A1) — Level A, required.
2. QuickSearch option/button nesting (A2).
3. Login `minLength` (A5).
4. Billing page undefined tokens (A8 + UX C1) — ring and colors.
5. Stream `aria-live` verbosity (A3).
6. Accent contrast bump (A4).
