# Features — verified working

_Persona: Frontend Tester_

Evidence-backed list of functionality that works as intended. This is the "what
works" counterpart to `bugs.md` / `errors.md`. Anything marked ✅ was exercised in
this pass (build, smoke test, runtime probe, or direct code verification).

> **Implementation status (2026-08-10): every finding in `bugs.md` (B1–B13) and
> `errors.md` (E1–E12) was implemented and verified against the checks below.
> Final gates: **128 tests** (`npm test`), `tsc --noEmit` clean, ESLint **0
> errors** (7 pre-existing warnings), and a clean `next build`.**

## Smoke test results

Production build (`npm run build` → `next start` on port 3999), local environment
without AI keys (rule-based fallback engine).

| Check | Result |
| --- | --- |
| Build | ✅ 35 routes compiled, no errors; first-load shared JS ≈ 88 kB |
| `/`, `/history`, `/saved`, `/actions`, `/settings` | ✅ 200 |
| `/analysis/:id` (arbitrary id) | ✅ 200 (data-cache miss path renders correctly) |
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | ✅ 200 |
| `/privacy`, `/terms` | ✅ 200 |
| `/share/:id` | ✅ 200 |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` | ✅ 200 |
| `POST /api/analyze/stream` (real text) | ✅ 200, SSE `done` event with a valid rule-based `AnalysisResult` |
| `POST /api/analyze/stream` (21,000 chars) | ✅ 413 JSON error |
| `POST /api/analyze/stream` (empty text) | ✅ 400 JSON error (was 200 + SSE error — E5) |
| `POST /api/translate` (text → `tl`) | ✅ 200 with `{ translated }` |
| `POST /api/translate` (missing text) | ✅ 400 |
| `POST /api/translate` (invalid lang `xx`) | ✅ 400 unsupported language (allowlist — E11) |
| `parseDeadline("in 3 days")` / `"3 days"` / `"tomorrow"` / `"bukas"` | ✅ correct dates via chrono |
| `parseDeadline("end of day")` / `"EOD"` / `"cob"` | ✅ today 17:00 via regex fallback |
| `parseDeadline("end of the day")` / `"end of today"` | ✅ today 17:00 (short-circuit — B1) |
| `parseDeadline("end of this month")` | ✅ last day of month 17:00 (short-circuit — B1) |

## Working areas

### Analysis flow (dashboard)
- ✅ Streaming analysis reveals fields progressively (`streamAnalysis` +
  `STREAM_FIELD_ORDER`), with a 10s SSE heartbeat and a 120s client timeout
  (`src/lib/stream.ts`, `src/app/api/analyze/stream/route.ts`).
- ✅ Server-action fallback (`analyzeText`) and rule-based engine
  (`runRuleAnalysis`) produce a complete, validated `AnalysisResult` when no AI
  provider is configured (`src/app/actions/analyzeText.ts`, `src/lib/analyzeRules.ts`).
- ✅ Result sections (actions, deadlines, urgency meter, confusing parts, next
  step, summary with `<mark>` highlights) render as React text nodes — no HTML
  injection; `sanitizeSummary` defense-in-depth for plain-text consumers.
- ✅ Results auto-save to history on completion; cancel aborts the fetch and
  shows a neutral "Analysis cancelled" notice with Retry (B2 fixed).
- ✅ Deadlines export to `.ics` and Google/Outlook deep links
  (`src/lib/deadline.ts`).

### Input & file handling
- ✅ `⌘/Ctrl+Enter` analyzes; `Esc` clears text; Analyze button disabled while
  empty or loading (`InputArea.tsx:82–91`).
- ✅ Whole-page + in-area drag-and-drop with overlay; file picker with
  `.txt/.pdf/.docx/.png/.jpg/.jpeg` accept; 10 MB cap (`InputArea.tsx:17–18`).
- ✅ Extraction paths verified in code: plain text, PDF (pdfjs), DOCX (mammoth),
  images (Tesseract OCR) (`extractTextFromFile`, `InputArea.tsx:22–63`).
- ✅ Inline file errors with `role="alert"`; extracting spinner overlay.

### Actions board
- ✅ 3 columns (To do / Doing / Done), drag-and-drop between columns, urgency
  labels, per-item move buttons + keyboard support, "Urgent only" toggle,
  urgency filter (`src/components/board/*`).
- ✅ A11y touches: live announcements on move, progress bar, focus handling.

### Sharing
- ✅ Share dialog with focus trap, Esc/overlay close, copy-link and copy-markdown
  (both via `copyText` with fallback + confirmation), raw-input include toggle
  with sensitive-content warning, "Include raw input" unchecking supported
  (`src/components/share/*`, `src/lib/share.ts`).
- ✅ `parseShareToken` single-decode (the earlier double-`enc:` bug is fixed);
  covered by `tests/share.test.ts`.

### Data & persistence
- ✅ Local-first via `localStorage` with a storage-error event → "Download
  backup" banner on History (`TaskContext`, `HistoryView.tsx:55–60`).
- ✅ History/saved/settings export to JSON (`downloadJson`) and import with
  record-shape validation (`readJsonFile`, `HistoryView.tsx:33–43,84–99`).
- ✅ Board state, templates, and settings all persist and hydrate; optional
  account sync via Turso (`AuthContext`, `/api/users/me`).

### Navigation & performance
- ✅ Route skeletons with per-route fidelity (`RouteSkeletons`), instant swap via
  `data-cache` (`src/lib/dataCache`), hover prefetch (`SmartLink`),
  scroll restoration, route-change cancellation (`useNavigation`).
- ✅ ⌘K QuickSearch over commands/history/templates/board with keyboard
  navigation, an empty state, and stable per-row ARIA ids (B7 fixed).

### Theme & appearance
- ✅ System/light/dark with a pre-hydration inline script — **no flash of wrong
  theme** on reload (`app/layout.tsx` + `ThemeProvider`).
- ✅ Reduced-motion fallback in CSS; skeleton shimmer and panel transitions
  respect it.
- ✅ Custom design tokens (ink/line/surface/med/high/accent) defined via Tailwind
  v4 `@theme` in `globals.css`; responsive layout (sidebar on lg+, bottom nav on
  mobile, ads rail on lg+).

### Security posture (re-checked this pass)
- ✅ No `dangerouslySetInnerHTML` for model output (removed previously;
  confirmed only static JSON-LD + theme script use it).
- ✅ All public endpoints enforce rate limits + size limits (see `docs/security.md`
  endpoint table).
- ✅ Passwords hashed (scrypt), sessions HMAC-signed HttpOnly cookies.

## Unit test coverage (this branch)

| Suite | File | Focus |
| --- | --- | --- |
| `deadline.test.ts` | `tests/deadline.test.ts` | parsing, sorting, calendar URLs |
| `urgency.test.ts` | `tests/urgency.test.ts` | classification, horizons, `urgencyForAction` |
| `format.test.ts` | `tests/format.test.ts` | date/time/relative formatting |
| `actionUtils.test.ts` | `tests/actionUtils.test.ts` | action extraction + dedupe |
| `share.test.ts` | `tests/share.test.ts` | share token build/parse |
| `auth.test.ts` | `tests/auth.test.ts` | auth flows, session helpers |
| `mailgun.test.ts` | `tests/mailgun.test.ts` | Mailgun endpoint/error mapping |
| `db.test.ts` | `tests/db.test.ts` | Turso/DB helpers |
| `rateLimit.test.ts` | `tests/rateLimit.test.ts` | fixed-window limiting |
| `ai.test.ts` | `tests/ai.test.ts` | AI client parsing/retry |
| `deadline.test.ts` (extended) | `tests/deadline.test.ts` | new: "end of …" variants, "in N days" regex fallback, 24h clock |

**Total: 128 tests passing** (`npm test`, 10 files). `npm run typecheck` passes;
`npm run lint` passes with **0 errors** — 7 pre-existing warnings remain
(unused imports in `auth/*` pages, `verify.ts`, `log.ts`, `auth.test.ts`).
The two `ThemeProvider.tsx` `set-state-in-effect` warnings were eliminated by
the E4 fix.
