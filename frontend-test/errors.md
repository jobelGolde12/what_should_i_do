# Errors — handling & resilience gaps

_Persona: Senior Developer_

Non-fatal but worth-hardening behavior. These don't produce wrong *output* in the
common path (unlike `bugs.md`), but they leave users uninformed, retry needlessly,
or degrade silently. Grouped by area.

> **Implementation status (2026-08-10): all of E1–E12 below were implemented and
> verified — full suite (128 tests), `tsc --noEmit`, ESLint (0 errors), and
> `next build` all pass. Every entry is marked `— ✅ FIXED`; the applied change is
> described inline and cross-checked by the smoke tests in `features.md`.**

---

## Feedback / user information

### E1 — Silent streaming fallback on non-OK responses — ✅ FIXED
- `src/lib/stream.ts:55–57` throws a generic `"Streaming analysis unavailable"`;
  `src/components/dashboard/DashboardHome.tsx:89–93` catches it and silently runs
  the blocking server action instead.
- **Impact**: When streaming fails (network, proxy, 429/413), the analysis still
  completes but the user is never told why it switched modes or that it took the
  slower fallback. With the AI provider absent, the rule-based result arrives
  with no indication it's a fallback.
- **Suggestion**: Surface a non-blocking notice ("Used faster offline analysis")
  and log the reason; keep the silent-fallback behavior only for expected
  provider outage.
- **Applied**: `src/lib/stream.ts` now throws `StreamUnavailableError` on non-OK
  responses; `DashboardHome.tsx` catches it and shows a `role="status"` notice
  ("Streaming was unavailable…") before running the blocking fallback.

### E2 — Clipboard failure in ConfusingList is silent — ✅ FIXED
- `src/components/results/ConfusingList.tsx:33–44` — `navigator.clipboard.writeText`
  is called directly; on failure the catch does nothing (`setCopiedIndex(null)`).
  There's no fallback (`document.execCommand('copy')`) and no error message.
- Contrast with `ShareDialog`, which routes through the `copyText` helper with a
  fallback and a "copy failed" message.
- **Suggestion**: Reuse the `copyText` helper (or move it into `src/lib/` and
  share it), and show a brief failure state instead of silently doing nothing.
- **Applied**: added a shared toast store (`src/lib/toast.ts`) + `<Toaster />`
  (`src/components/ui/Toast.tsx`, mounted in root layout). ConfusingList now
  copies via `copyText` and toasts "Copied" / "Copy failed".

### E3 — TranslationBlock keeps stale content when collapsed — ✅ FIXED
- `src/components/results/TranslationBlock.tsx:64–67` — collapsing sets
  `language = "en"` but leaves `translated` / `error` set. Reopening shows the
  previous translation with no language highlighted (state mismatch).
- Also `translate()` runs on every language click, including re-clicking the
  already-active language (`TranslationBlock.tsx:90–93`), causing a pointless
  refetch.
- **Suggestion**: Clear `translated`/`error` on collapse; skip the fetch when
  `target === language` (only `setOpen(true)`).
- **Applied**: `togglePanel()` now resets `language`/`translated`/`error` on
  collapse; re-clicking the active language is a no-op; selecting "en" clears any
  stale output.

### E4 — ThemeProvider's `resolvedTheme` lags the DOM on first paint — ✅ FIXED
- `src/context/ThemeProvider.tsx:58,66–77` — `systemPrefersDark` starts `false`
  and is only set after mount. With `theme === "system"` on a dark OS, React
  state briefly reports `resolvedTheme === "light"` even though the pre-hydration
  inline script in `app/layout.tsx` paints the correct dark CSS (so there's no
  flash-of-wrong-theme — only React state is stale).
- **Impact**: Any consumer reading `resolvedTheme` during first render sees
  "light"; e.g. the Settings theme selector's "Currently showing light/dark"
  caption can be wrong for one frame.
- **Suggestion**: Read `matchMedia` synchronously into initial state (guarded by
  `typeof window !== "undefined"`), or derive the initial resolved value from a
  script-set attribute on `document.documentElement`.
- **Applied**: `ThemeProvider` lazily initializes `theme` from storage and
  `systemPrefersDark` from `matchMedia` in the initial state (guarded). This also
  removed the two pre-existing `set-state-in-effect` lint warnings. The Settings
  "Currently showing …" caption has `suppressHydrationWarning`.

### E5 — Empty/short input: HTTP 200 with an error *inside* the stream — ✅ FIXED
- `src/app/api/analyze/stream/route.ts:70–78,106–110` — for empty or <10-char
  text the route returns **200** with a `{ type: "error" }` SSE event rather than
  a 400. The client does handle it (throws `new Error(payload.message)`,
  `stream.ts:95–97`), so behavior is correct end-to-end — but the status code
  contradicts the REST expectation set by the 413/429 cases (lines 35–51).
- **Suggestion**: Keep it documented or change empty-input to 400; make sure the
  client's `if (!response.ok)` branch still throws the same user-facing message.
- **Applied**: empty/<10-char input now returns **400** with a JSON error body
  (matches the 413/429 convention); `stream.ts` reads the JSON body on non-OK and
  throws with the real message. Verified via smoke test (empty text → 400).

---

## Account / auth resilience

### E6 — Register can return 502 after creating the account (mail failure) — ✅ FIXED
- `src/app/api/auth/register/route.ts:96–112` — user row is created, then
  `sendVerification` may fail; the route returns **502** with a helpful message
  ("Account created, but we could not send the verification email…").
- **Impact**: The AuthForm shows it as an error (red box). A user retrying gets
  "An account with this email already exists" (409) and may think their
  registration failed twice. The 502 message does point to "resend from the
  sign-in page", but the UI doesn't offer a resend button in this state.
- **Suggestion**: In `AuthForm`, recognize a 502 on register and render the
  "check your email / resend" screen instead of the error box (reuse the
  `verificationSent` branch).
- **Applied**: the register 502 response now carries a machine-readable
  `requiresVerification: true` + `email`; `AuthContext` `AuthError` carries a
  `requiresVerification` flag and `AuthForm` routes to the verification-sent
  screen when it is set (no string matching — fixes B9 too).

### E7 — Non-quota AI errors silently degrade to rules — ✅ FIXED
- `src/app/actions/analyzeText.ts:80–86` — only `ALL_KEYS_EXHAUSTED` and
  `API_KEY_EXHAUSTED` are rethrown; every other AI failure (malformed output,
  provider 5xx, unknown) falls back to rules. Same behavior in the streaming
  route (`route.ts:101–123`).
- **Impact**: Users get a lower-quality rule-based result with no indication the
  AI step failed. Combined with E1, it's hard to tell when the app is running on
  the fallback engine at all.
- **Suggestion**: Log the fallback reason server-side and return an
  `analysisMethod: "fallback"` flag (already present in the result type,
  `analyzeText.ts:41`) so the UI can tag it.
- **Applied**: both the server action (`analyzeText.ts:78`) and the stream route
  (`route.ts:111`) `console.warn` the fallback reason; `ResultsPanel.tsx:162`
  renders a "Rule-based" vs "AI analysis" tag from `result.analysisMethod`.

---

## Data / text fidelity

### E8 — `cleanText` strips all non-ASCII characters — ✅ FIXED
- `src/lib/analyzeRules.ts:38` — `/[^\x20-\x7E]/g` removes every char outside the
  printable ASCII range, silently deleting accented letters and other Unicode in
  Filipino/Spanish/names input before analysis.
- **Impact**: "Mañanita", "dáyaw", em-dashes, smart quotes — all gone. This can
  also mangle OCR output from `extractTextFromFile` (e.g. en-dash → nothing).
- **Suggestion**: Replace the blanket strip with a targeted normalization
  (keep letters incl. Latin-1 + punctuation), or move it into the OCR-specific
  path only.
- **Applied**: `cleanText` now keeps Latin-1 / Latin Extended letters (ñ, á, é,
  ç, ·, …, etc.) and only strips control/undesirable characters. Covers B13.

### E9 — `enhanceInput` rewrites single letters globally — ✅ FIXED
- `src/lib/analyzeRules.ts:50–82` — OCR fixes include `'u' → 'you'`, `'r' → 'are'`
  (lines 69–71) applied with `\b…\b` word boundaries. A message containing "Dr."
  → "are." is fine, but standalone "R" (a common initial/family name) or "U"
  (university, building) becomes "are"/"you".
- **Suggestion**: Restrict the single-letter substitutions to short, all-lowercase
  informal contexts or remove them; keep only multi-char OCR fixes.
- **Applied**: removed the single-letter OCR fixes (`'u' → 'you'`, `'r' → 'are'`);
  only multi-character substitutions remain.

### E10 — History import doesn't reset search/filter — ✅ FIXED
- `src/components/history/HistoryView.tsx:84–99` — `importHistory(records)` appends
  records, but the active `query`, `filter`, and `visible` (pagination) are not
  reset. If the user had "Urgent" filtered or a search active, newly imported
  (unfiltered) records won't appear and the UI gives no "imported N records"
  confirmation beyond the list growing.
- **Suggestion**: After a successful import, clear `query`, set `filter` to
  `"all"`, reset `visible`, and show a transient "Imported N records" status.
- **Applied**: on a successful import `HistoryView` clears `query`, resets the
  filter to `"all"`, resets `visible`, and toasts "Imported N records".

---

## API robustness (minor)

### E11 — `/api/translate` maps provider errors to 502 — ✅ FIXED
- `src/app/api/translate/route.ts:138–144` — any provider failure (including an
  invalid 2-letter lang like `xx`, which passes the `[a-z]{2}` check at line 110)
  is surfaced as a 502 with the provider's raw message. The 400 path only covers
  missing text / malformed lang.
- **Suggestion**: Validate `target` against a known-language allowlist (the UI
  already ships one — `TranslationBlock.tsx:7–15`) for an immediate 400, and
  map provider errors to a stable user-facing message.
- **Applied**: `SUPPORTED_LANGS` allowlist (`tl, es, fr, de, it, pt`) returns 400
  for unsupported targets (e.g. `xx`); provider errors map to a stable message.
  Verified via smoke test (`xx` → 400, `tl` → 200).

### E12 — `register` 503 when Mailgun unconfigured in production — ✅ FIXED
- `src/app/api/auth/register/route.ts:68–73` — with no Mailgun config in a
  production build, registration returns a generic 503. Correct behavior, but the
  message ("Email service is not configured") leaks deployment state to end users.
- **Suggestion**: Return a neutral message ("Registration is temporarily
  unavailable") and log the real reason server-side.
- **Applied**: the 503 message is now neutral ("Registration is temporarily
  unavailable") with the real reason logged server-side.
