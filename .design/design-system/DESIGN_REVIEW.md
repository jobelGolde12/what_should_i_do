# Design Review: Design System & Responsive UI (F23)

Reviewed against: `design.md` (premium / editorial / architectural aesthetic)
Date: 2026-08-08

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-home-desktop-1280.png` | Desktop (1280×1400) | Home — hero, input, sections |
| `screenshots/review-home-tablet-768.png` | Tablet (768×1400) | Home |
| `screenshots/review-home-mobile-375.png` | Mobile (375×1400) | Home — top bar + bottom nav |
| `screenshots/review-home-dark-1280.png` | Desktop, dark | Home (flag-based dark; verify) |
| `screenshots/review-actions-desktop-1280.png` | Desktop | Actions board |
| `screenshots/review-actions-mobile-375.png` | Mobile | Actions board (stacked columns) |
| `screenshots/review-settings-desktop-1280.png` | Desktop | Settings |
| `screenshots/review-history-desktop-1280.png` | Desktop | History |

> Reviewer note: screenshots were captured headlessly with Google Chrome. Visual
> confirmation of the screenshots themselves is required (the reviewing model
> cannot read image input) — see the checklist items marked "verify visually".

## What Changed This Round (F23)

- **Tokens**: added `--text-xxs`, `--text-2xs`, `--radius-tm`, and four tracking
  tokens to the `@theme` map; replaced ~120 arbitrary values (`rounded-[3px]`,
  `text-[10px]`, `text-[11px]`, `tracking-[0.12/0.16/0.18/0.2em]`) across the app.
  Verified compiled CSS sets font-size only (no line-height drift).
- **Keyboard focus**: global `:focus-visible { outline: 2px solid var(--accent) }`
  in `globals.css` (unlayered, so it wins over `outline-none`). Applies to all
  raw buttons, links, and inputs.
- **No-JS**: `html.no-js` set in SSR, removed by an inline script; `.no-js`
  guard forces settle sections visible.
- **A11y**: `aria-current` on sidebar nav, `aria-pressed` on filters/toggles
  (ActionsBoard, HistoryView, TranslationBlock, urgent focus), `aria-expanded`
  + `aria-controls` (ConfusingList, TranslationBlock), `<main>` landmarks +
  h1 on ShareView/AuthForm, `role="alert"`/`aria-live` on import/sync/streaming
  feedback, focus trap + focus restore + autofocus in ShareDialog, keyboard
  reachable file upload in InputArea, `aria-label` on calendar links and
  template inputs, urgency dot now `role="img" aria-label`.
- **Contrast**: replaced `text-muted/50`/`/60`/`/70` and the undefined
  `text-danger` (→ `text-high` in DeadlineList) with full-token colors.
- **Responsive**: HistoryView filter row now `flex-wrap`; board cards
  `break-words`.
- **Consistency**: shared `src/lib/nav.ts` nav config (Sidebar + BottomNav);
  hand-rolled buttons replaced with shared `Button`/`LinkButton` (DeadlineList,
  NextStepCard, ShareView). Fixed a real bug: QuickSearch navigated to the
  nonexistent `/board` → now `/actions`.
- **Docs**: `docs/design-system.md` inventories tokens and components.

## Checklist

### Visual Hierarchy
- Home hero, input area, and results ordering unchanged. Verify visually on
  `review-home-desktop-1280.png`.

### Consistency
- Pass: repeated micro-label type/tracking/radius values now come from tokens.
- Pass: buttons use shared `Button`; focus ring is single-source.
- Note: `min-h-[250px]` / `max-w-[336px]` ad-slot values intentionally remain
  literal (functional ad dimensions, not design tokens).

### Aesthetic Fidelity
- Token replacement was value-identical (10px/11px/3px/em spacings), so no
  visual drift expected. Verify visually.

### Component Quality
- Pass: no duplicate components introduced; `nav.ts` removed the triplicated
  nav config.

### States and Interactions
- Pass: all interactive elements now have keyboard focus rings; toggles/filters
  expose pressed state to AT.
- ShareDialog now traps focus and restores focus on close.

### Responsive Behavior
- Pass: board columns stack below `md`; filters wrap; cards break long words.
- Verify visually at `-mobile-375.png` (bottom nav labels now longer: "New
  Analysis"/"My Actions" — confirm no overflow/cramping at 320–375px).

### Accessibility
- Pass (code): contrast of previously failing `text-muted/50`-type text
  corrected; `text-danger` bug fixed; landmarks, live regions, aria semantics
  added.
- Verify visually: dark-mode contrast of the new outline token.

### Typography
- Pass: font-size token utilities compile to `font-size` only; line-height
  inherited exactly as before.

### Dark Mode
- `review-home-dark-1280.png` was captured with
  `--force-prefers-color-scheme=dark`; its byte size matched the light capture,
  so **verify visually** whether dark theme actually applied. If not, dark
  screenshots need re-capture via the theme toggle with localStorage.

## Must Fix
1. **Dark screenshot uncertain** — confirm dark mode rendered in
   `review-home-dark-1280.png`; re-capture if not. (Visual check required.)

## Should Fix
1. **Bottom nav label length at ≤375px** — "New Analysis"/"My Actions" are
   longer than the old labels; confirm they wrap gracefully in
   `review-home-mobile-375.png`.
2. **AdsRail `w-[25vw]`** — intentional ad width, but confirm the rail stays
   within content gutter at 1024px (verify on tablet).

## Could Improve
- Storybook + visual regression snapshots and E2E interaction tests (deferred —
  see `docs/design-system.md`).

## What Works Well
- Single global keyboard-focus rule replaced ~10 ad-hoc focus fixes.
- Token-based micro-typography keeps the mono-label aesthetic consistent app-wide.
- The no-js guard closes a real accessibility edge case with two lines of CSS.
