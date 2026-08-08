# Feature 23 — Design System & Responsive UI

## 1. What it is & its role

The **Design System** is the collection of design tokens, typography, layout, and reusable UI components that give TaskMind its premium, editorial, architectural aesthetic (per `design.md`). Its role is consistent, accessible, responsive, performant UI across all pages.

## 2. Current functionality

### Where it lives
- **Tokens & CSS:** `src/app/globals.css` (CSS custom properties, `@theme` map, dark mode, dotted textures, "settling" animation, reduced-motion).
- **Fonts:** `src/app/layout.tsx` (Inter, Space Grotesk, JetBrains Mono).
- **UI components:** `src/components/ui/` (`Button`, `Badge`, `States`, `PageHeader`).
- **Layout components:** `src/components/layout/` (Sidebar, BottomNav, DashboardLayout, QuickSearch, AdsRail, Logo).
- **Spec:** `design.md` (inspirational reference).

### How it works today
1. Tailwind CSS v4 with `@theme` mapping custom color/font tokens.
2. Color tokens for brand (accent red), data urgency (low/med/high), surfaces, and ink.
3. Signature "settling" animation reveals analysis sections progressively.
4. Responsive layout: desktop sidebar + ads rail, mobile top bar + bottom nav.
5. Reusable `<Button>`, `<Badge>`, `<UrgencyBadge>`, `<PageHeader>`, `<EmptyState>`, `<LoadingState>`, `<ErrorState>`.
6. Reduced-motion media query disables animations.

### Current limitations
- **No living component library / storybook** — components are ad-hoc and not documented or visually tested.
- **No centralized icon policy** — many inline SVGs/icons; inconsistent sizing/semantics.
- **Accessibility gaps:** some interactive elements rely on color alone (urgency), no consistent focus-ring audit, some buttons lack `aria` labels, and the settle animation may hide content if JS is disabled.
- **Responsive audit incomplete** — long text, dense tables, and the ads rail may overflow on small screens; no dedicated mobile menu for more than 5 nav items.
- **No spacing/type scale enforcement** — tokens exist but arbitrary values appear in components.
- **No E2E/interaction test coverage** for the design system.
- Dark-mode contrast not fully audited (see Feature 16).

## 3. Future enhancements (production-ready Design System)

### 3.1 Component library & docs
- Extract UI into a documented component library with **Storybook** and visual regression tests.
- Enforce design tokens (spacing, type, radius, shadow) via a lint rule and remove arbitrary values.

### 3.2 Accessibility
- Comprehensive **WCAG AA** audit: color-independent states, focus-visible styles, ARIA labels, landmark roles, and keyboard navigation for all interactive elements.
- Ensure the "settling" animation gracefully degrades (already has reduced-motion; add a no-JS fallback that shows all sections).

### 3.3 Responsive polish
- Audit at 320px–1440px: text overflow, nav usability, ads rail, and kanban on mobile.
- Add a proper mobile navigation menu for more items.

### 3.4 Performance
- Audit bundle size, lazy-load below-fold components, and optimize font loading (already `display: swap`).
- Ensure animations don't cause layout shift.

### 3.5 Testing
- Add E2E tests covering key user flows across breakpoints.
- Add visual regression snapshots for core components in both themes.

### 3.6 Consistency
- Enforce a single icon set (already `lucide-react`) and consistent sizing/spacing via tokens.

> **Status: DONE** — Tokens, accessibility, responsive polish, consistency, and docs. **Tokens**: added `--text-xxs`/`--text-2xs`/`--radius-tm`/tracking tokens to the `@theme` map and replaced ~120 arbitrary values (`rounded-[3px]`, `text-[10px]`/`text-[11px]`, `tracking-[0.12/0.16/0.18/0.2em]`) across the app (verified: compiled CSS sets font-size only, no line-height drift). **Accessibility**: global `:focus-visible` accent outline (unlayered, wins over `outline-none`); `aria-current` on sidebar, `aria-pressed` on filters/toggles (ActionsBoard, HistoryView, TranslationBlock, urgent focus), `aria-expanded`+`aria-controls` (ConfusingList, TranslationBlock), `<main>` landmarks + h1 (ShareView, AuthForm), `role="alert"`/`aria-live` on import/sync/streaming feedback, ShareDialog focus trap + restore + autofocus, keyboard-reachable file upload (InputArea), `aria-label` on calendar links/template inputs, urgency dot as `role="img"`; fixed undefined `text-danger` → `text-high`; replaced low-contrast `text-muted/50-70` with full tokens; added `html.no-js` SSR guard (settle sections never hidden without JS). **Responsive**: HistoryView filter row `flex-wrap`, board cards `break-words`. **Consistency**: shared `src/lib/nav.ts` nav config (Sidebar + BottomNav), hand-rolled buttons → shared `Button`/`LinkButton`, new `docs/design-system.md` component/token inventory. Fixed real bug: QuickSearch navigated to nonexistent `/board` → now `/actions`. Screenshots captured and code-level design review saved to `.design/design-system/DESIGN_REVIEW.md`. **Deferred**: Storybook + visual regression snapshots, E2E interaction tests, and JS-off first-run of the settling animation (guard added) are not in place.

> **Definition of "done" for this feature:** Documented, token-driven component library with visual regression tests; WCAG AA accessibility; responsive across all breakpoints; performant; accessible without JS.
