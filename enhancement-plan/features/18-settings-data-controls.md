# Feature 18 — Settings & Data Controls

## 1. What it is & its role

The **Settings** page groups appearance, keyboard shortcuts, and local data controls in one place. Its role is to give users control over the app's look and their stored data.

## 2. Current functionality

### Where it lives
- **UI:** `src/components/settings/SettingsView.tsx` + route `src/app/settings/page.tsx`.
- **State/data:** `src/context/TaskContext.tsx`, `src/context/ThemeProvider.tsx`, `src/lib/storage.ts`.

### How it works today
1. **Appearance:** light/dark/system theme switcher (see Feature 16).
2. **Keyboard shortcuts:** a static reference list (⌘/Ctrl+Enter to analyze, Esc to clear, ⌘/Ctrl+K to search).
3. **Data:** shows a count of stored items (history + templates + board) and a "Clear all local data" button (confirm dialog → `clearHistory()` + delete templates).
4. Footer text describing the product.

### Current limitations
- **Static shortcut list** — not configurable, and some shortcuts may not be discoverable elsewhere.
- **No per-data-type clearing** (all-or-nothing via the confirm; History page has separate clear).
- **No account/preferences** (language, default theme per user, notification prefs) since there's no auth (Feature 19).
- No export/import of data (see Feature 11).
- No explanation of what happens to data / privacy details beyond one line.
- No unit/preferences (e.g., date format, timezone) even though deadlines depend on timezones (Feature 02).

## 3. Future enhancements (production-ready Settings & Data Controls)

### 3.1 Granular data controls
- Clear **history**, **board**, **templates**, and **theme** independently.
- Add **export all data** (JSON backup) and **import**.
- Add **per-record** management already partially present in History/Saved.

### 3.2 Preferences & i18n
- Add **UI language**, **default analysis language**, **date/time format**, and **timezone** settings.
- Add **notification** preferences (deadline reminders from Feature 02).

### 3.3 Configurable shortcuts
- Allow users to view/edit keyboard shortcuts (with reset to defaults).

### 3.4 Account settings (tie-in to Feature 19)
- When auth exists: account/profile, cross-device sync toggle, delete-account, and data-export/erasure (GDPR-style).

### 3.5 Privacy transparency
- Add a **privacy section** linking to a privacy policy, data-retention summary, and "everything is stored locally/by default" explainer.

### 3.6 Accessibility & testing
- Ensure all controls are keyboard-accessible with labels.
- Unit tests for clear/export/import logic; E2E for theme switching and data clearing.

> **Status: DONE** — Implemented in this round: granular data controls (clear history / templates / actions board independently plus "clear all" with confirm dialogs); export all data as a `taskmind-backup` JSON and import with validation (`isDataBackup`) and dedupe-by-id merging via new `importTemplates`/`importBoard` in `TaskContext` (plus `clearBoard`/`clearTemplates`); privacy transparency section explaining local storage, provider sharing during analysis, share-link encoding, and non-recoverable clears. UI-language/timezone/date-format preferences, configurable shortcuts, account settings, and CMP-style consent UI deferred to F19/auth and later rounds.

> **Definition of "done" for this feature:** Settings provides granular data control, export/import, localizable preferences, timezone/date settings, account + privacy surfaces, and full testing.
