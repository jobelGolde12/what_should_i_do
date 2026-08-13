# Pro Plan — 07 · Exports, Reports & Analytics

**Status:** `[ ]` Not started · `[ ]` In progress · `[ ]` Done

## What it is & why it's Pro

Free users can only export JSON (`downloadJson` in `src/lib/backup.ts`). Pro
users get **shareable, professional exports** (PDF / Word / CSV of an analysis,
history, or the actions board) plus **productivity analytics** — actions
completed, deadlines met/missed, urgency distribution — and a monthly report
email. This gives users a reason to keep their data inside TaskMind.

## Where it fits today

- Exports: JSON download/import in `HistoryView.tsx`/`SettingsView.tsx`; share
  links + markdown (`src/lib/share.ts`). No PDF/Word/CSV generation in the app.
- Data: `AnalysisRecord` (`src/lib/types.ts`), board items with `status`,
  deadlines via `parseDeadline`.
- Conversion deps: plan `02` introduces `pdf-lib`/`docx` — reuse for exports.

## Depends on

- `02-document-conversion.md` (PDF/DOCX generation primitives)
- `00-entitlements-and-gating.md` (Pro-only + quota)

---

## Tasks

### 1. Export primitives

- [ ] Add `src/lib/export/`: `analysisToPdf(result)`, `analysisToDocx(result)`,
  `analysisToCsv(result)` and `historyToCsv(records)` reusing `pdf-lib`/`docx`
  primitives from plan `02` (shared `src/lib/convert/` layer).
- [ ] Define a branded layout: app name/logo, generated date, and the analysis
  sections (summary, actions, deadlines, urgency, confusing parts).

### 2. Export API + UI

- [ ] Add `src/app/api/export/route.ts` (POST, `requirePro`, session required):
  `{ kind: "analysis" | "history" | "actions", id?, format: "pdf"|"docx"|"csv" }`
  → streamed file with correct content-type/filename.
- [ ] Add "Export as PDF / DOCX / CSV" menus in `ResultsPanel` (per analysis) and
  `HistoryView`/board (bulk), plus CSV download of the actions board.
- [ ] Enforce export quota via `src/lib/pro/usage.ts`; toast on success/failure
  (`src/lib/toast.ts`).

### 3. Productivity analytics

- [ ] Add `src/lib/analytics.ts`: compute from history/board — actions created vs
  completed, deadline met/missed ratios, urgency distribution, weekly activity,
  current streak (uses `parseDeadline` + board `status`).
- [ ] Add `src/components/reports/ReportsView.tsx` + a Reports route/nav entry:
  summary cards, simple charts (pure CSS/SVG — no chart lib dependency), and
  filters by date range.
- [ ] Persist "completed" actions already tracked in board (`BoardStatus`); backfill
  from history if needed.

### 4. Monthly report email

- [ ] Add `src/app/api/cron/report/route.ts` (monthly, `CRON_SECRET`): builds a
  digest from `src/lib/analytics.ts` and emails it via `src/lib/mailgun.ts`.
- [ ] Opt-in/opt-out toggle in Settings ("Monthly report").

### 5. Tests

- [ ] Unit: `tests/export.test.ts` — analysis→pdf/docx/csv bytes for a fixture,
  filename/content-type mapping, quota increment.
- [ ] Unit: `tests/analytics.test.ts` — metrics with a fixed fixture set.
- [ ] Route tests: 403 non-Pro, 400 unknown kind/format, quota limit.

## Definition of done

- [ ] Pro users download a polished PDF/DOCX/CSV of an analysis, history, or the
  board; free users see the upgrade CTA.
- [ ] Reports view shows accurate analytics; monthly report emails opt-in users.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
