# TaskMind Design System

Living inventory of design tokens and reusable UI components. See `design.md` for
the aesthetic rationale (premium / editorial / architectural).

## Tokens

Defined in `src/app/globals.css` (`:root`, `[data-theme="dark"]`, and the Tailwind
v4 `@theme` map that turns them into utilities).

### Color
| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#141414` | page canvas |
| `--surface` | `#f7f7f5` | `#1c1c1b` | raised panels |
| `--surface-2` | `#efefec` | `#242422` | hover fills |
| `--ink` | `#171717` | `#ededeb` | primary text |
| `--muted` | `#6b6b6b` | `#a3a3a0` | secondary text |
| `--line` | `#dcdcdc` | `#2e2e2c` | dividers / borders |
| `--accent` | `#c8102e` | `#e2445f` | brand red — logo, primary actions, settling moment |
| `--accent-dark` | `#9f0d24` | `#c8102e` | accent hover |
| `--accent-soft` | `#fdebee` | `rgba(200,16,46,.16)` | accent tint fills |
| `--night` | `#111111` | `#0a0a0a` | inverted surfaces |
| `--night-soft` | `#1a1a1a` | `#171717` | inverted hover |

Data urgency semantics (information, not decoration):

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--low` / `--low-bg` | `#15803d` / `#f0f9f1` | `#4ade80` / `rgba(34,197,94,.14)` | Informational |
| `--med` / `--med-bg` | `#b45309` / `#fff7e6` | `#fbbf24` / `rgba(245,158,11,.14)` | Important |
| `--high` / `--high-bg` | `#b91c1c` / `#fef2f2` | `#f87171` / `rgba(239,68,68,.14)` | Urgent / error |

### Type scale
| Token | Value | Utility |
| --- | --- | --- |
| `--text-xxs` | `0.625rem` | `text-xxs` — micro labels |
| `--text-2xs` | `0.6875rem` | `text-2xs` — mono labels |
| `text-xs` / `sm` / `base` / `lg` | Tailwind defaults | body + UI text |
| `font-sans` | Inter | body |
| `font-display` | Space Grotesk | headings |
| `font-mono` | JetBrains Mono | labels, data, timestamps |

### Tracking
| Token | Value | Utility |
| --- | --- | --- |
| `--tracking-label` | `0.18em` | `tracking-label` |
| `--tracking-label-tight` | `0.16em` | `tracking-label-tight` |
| `--tracking-label-mono` | `0.12em` | `tracking-label-mono` |
| `--tracking-label-wide` | `0.2em` | `tracking-label-wide` |

### Radius
`--radius-tm: 3px` → `rounded-tm`. The signature crisp architectural radius;
prefer it over arbitrary `rounded-*` values.

### Spacing
Tailwind's default spacing scale is used throughout. Avoid arbitrary values
(`p-[13px]`, `ml-3.5`): if a recurring value needs a name, add a token.

## UI components (`src/components/ui/`)

| Component | Purpose |
| --- | --- |
| `Button` / `LinkButton` | Primary / dark / outline / ghost, sizes `sm`/`md`/`lg`. Always used for interactive buttons; carries the global focus ring. |
| `Badge` / `UrgencyBadge` | Neutral / tone labels; urgency uses a glyph + word (never color alone). |
| `PageHeader` | Page hero: kicker + title. |
| `EmptyState` / `LoadingState` / `ErrorState` | Page-level feedback states (`ErrorState` uses `role="alert"`). |

## Layout components (`src/components/layout/`)

| Component | Purpose |
| --- | --- |
| `DashboardLayout` | Desktop sidebar + content, mobile top bar, bottom nav, ads rail, quick search. |
| `Sidebar` | Desktop primary nav (uses shared `NAV_ITEMS` in `src/lib/nav.ts`). |
| `BottomNav` | Mobile bottom nav (same `NAV_ITEMS` source). |
| `QuickSearch` | ⌘K command palette / combobox. |
| `AdsRail` / `AdBlock` | Adsense units (only when configured + consented). |
| `Logo` | Wordmark. |

## Accessibility conventions

- **Keyboard focus**: `:focus-visible` gets a 2px `--accent` outline globally
  (see `globals.css`). Do not add `outline-none` to interactive elements; the
  global rule is deliberately unlayered so it wins.
- **State must not be color-only**: filters/toggles use `aria-pressed`, nav uses
  `aria-current`, urgency always pairs a word or glyph with color.
- **Buttons**: use the shared `Button` so focus + sizing stay consistent.
- **Dialogs** (`ShareDialog`, `QuickSearch`): move focus in, trap Tab, restore
  focus on close, `aria-modal="true"`.
- **Dynamic updates**: streaming results, sync/import feedback, and copy errors
  are announced via `aria-live`.
- **Motion**: `prefers-reduced-motion` collapses all animation to ~0ms.
- **No JS**: content always renders (`html.no-js` guard forces settle sections
  visible; the class is removed once JS runs).

## Responsive behavior

- Breakpoints: mobile `< 1024px` (bottom nav), desktop `≥ lg` (sidebar).
- Ads rail is `lg`-only; mobile uses a single centered `AdBlock`.
- Kanban columns stack vertically below `md`; cards use `break-words`.
- Nav/filter rows `flex-wrap` at small widths.

## Not yet built (deferred)

Storybook + visual regression snapshots and E2E interaction tests were deferred;
component coverage today is via the manual flows in `enhancement-plan/FEATURES-INDEX.md`.
