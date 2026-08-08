# Feature 16 — Theme Support

## 1. What it is & its role

The **Theme Support** feature provides **light**, **dark**, and **system** appearance modes using CSS custom properties and a React context. Its role is to make the interface comfortable across environments and respect the OS preference.

## 2. Current functionality

### Where it lives
- **Context:** `src/context/ThemeProvider.tsx` → `theme`, `setTheme`.
- **Preference type:** `src/lib/types.ts` → `ThemePreference`.
- **Tokens:** `src/app/globals.css` → `:root`, `:root[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`.
- **UI:** `src/components/settings/SettingsView.tsx` (appearance section).
- **Persistence:** `localStorage` key `taskmind:theme`.

### How it works today
1. Theme defaults to "system".
2. On mount, reads stored preference.
3. `setTheme` updates state, writes to storage, and toggles `data-theme="light"|"dark"` on `<html>`.
4. CSS uses `:root[data-theme="dark"]` and a `prefers-color-scheme: dark` block (applied only when not forced to light) to set tokens.
5. `globals.css` includes reduced-motion and dark dotted-texture overrides.

### Current limitations
- **No initial paint guard:** SSR markup has no `data-theme`, so the light theme flashes before hydration sets the stored dark theme (FOUC).
- `prefers-color-scheme` system handling is partially duplicated with the explicit dark block.
- No theme on the **share page** root mismatch (share view is outside the main provider graph for styling tokens — though tokens are global, theme toggle isn't applied there).
- No per-page/token audit for accessibility contrast in dark mode.

## 3. Future enhancements (production-ready Theme Support)

### 3.1 Eliminate flash of wrong theme (FOUC)
- Inline a script in `<head>` to set the theme class/data-attribute before paint, or use a `suppressHydrationWarning` + CSS-only `color-scheme` approach.

### 3.2 Unify system handling
- Use `window.matchMedia("(prefers-color-scheme: dark)")` with a change listener for live updates while in "system" mode.
- Single source of truth for theme token mapping.

### 3.3 Accessibility & contrast
- Audit all token pairs (text/muted on surface, low/med/high accents) in both themes for WCAG AA contrast.
- Respect `prefers-reduced-motion` and `prefers-contrast` where appropriate.

### 3.4 Apply theme app-wide
- Ensure the theme (including system) applies consistently on share and any standalone pages.

### 3.5 Testing
- Snapshot/e2e tests toggling light/dark/system.
- Contrast audit tests using computed styles.

> **Status: DONE** — Implemented in this round: FOUC eliminated with an inline `<head>` script that sets `data-theme` + `color-scheme` before first paint (reads stored pref, falls back to `prefers-color-scheme`); `ThemeProvider` now resolves "system" to a concrete `light`/`dark` value via `window.matchMedia` with a live change listener, always sets `data-theme`/`color-scheme` on `<html>`, and exposes `resolvedTheme`; the app-wide theme now applies to the share page automatically since the root layout wraps everything. Settings shows the current resolved theme. WCAG contrast audit and automated theme tests deferred.

> **Definition of "done" for this feature:** No theme flash on load, live system-preference updates, consistent app-wide theme, WCAG AA contrast, and automated theme tests.
