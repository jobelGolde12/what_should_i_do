# TaskMind — Frontend Test Report

Manual and semi-automated frontend testing of the TaskMind app ("what-should-i-do"),
conducted against the current `main2` branch.

**Scope**: end-to-end behavior of the Next.js frontend — navigation, dashboard
analysis flow, results rendering, history/saved/board/settings, sharing, auth,
ads, theme, and the supporting API routes. This is a frontend test pass, not a
backend audit (see `docs/security.md` for the API/security inventory).

## Personas & viewpoints

Findings are organized from three perspectives:

| Persona | Focus |
| --- | --- |
| **Senior Developer** | Correctness, data flow, state management, race conditions, robustness, refactors |
| **UI/UX Designer** | Visual consistency, copy, interaction patterns, empty/loading/error states, feedback clarity |
| **Frontend Tester** | Reproduction steps, edge cases, browser behavior, evidence of what actually works |

Each document states which persona wrote it in its header.

## How this was tested

1. **Static code review** — read every component, context, lib, API route, and
   page in `src/` (full coverage). Findings reference `file:line`.
2. **Unit suite** — `npm test` (Vitest): **128 tests across 10 files pass**
   (`actionUtils`, `ai`, `auth`, `db`, `deadline`, `format`, `mailgun`,
   `rateLimit`, `share`, `urgency`).
3. **Type/lint gates** — `npm run typecheck` (`tsc --noEmit`) passes; `npm run
   lint` passes with **0 errors** and 7 pre-existing warnings (unused imports in
   `auth/*` pages, `verify.ts`, `log.ts`, `auth.test.ts`).
4. **Production build** — `npm run build` succeeds (35 routes compiled; no
   errors). Smoke-tested with `next start` on port 3999.
5. **Runtime smoke tests** — HTTP checks against all routes and key API
   endpoints (results in `features.md` § Smoke test).
6. **Deadline parser probes** — `parseDeadline` exercised at runtime with
   `npx tsx` against a fixed "now" (Mon, Aug 10, 9:00 AM) to confirm suspected
   parsing issues (results in `bugs.md` § B1).

> **Implementation round (2026-08-10)**: after the findings above were written,
> every defect in `bugs.md` (B1–B13) and every hardening item in `errors.md`
> (E1–E12) was **implemented** in the source, with the quick-wins checklist in
> `enhancements.md` checked off. Verification re-run after implementation:
> 128 tests passing, `tsc --noEmit` clean, ESLint 0 errors, `next build` clean,
> and a second smoke pass (including new 400/400/200/413 assertions).

## Reproduce locally

```bash
npm install
npm run dev          # http://localhost:3000
# or
npm run build && npm start

npm test             # unit suite
npm run typecheck    # TS
npm run lint         # ESLint
```

Config comes from `.env` / `.env.local` (see `.env.example` for the full list).
Without `TOKENROUTER_*` keys the app still works: the streaming route and the
`analyzeText` server action transparently fall back to the rule-based analyzer
(`src/lib/analyzeRules.ts`), which is the mode exercised in this pass.

## Documents

| File | Persona | Contents |
| --- | --- | --- |
| [`bugs.md`](./bugs.md) | Senior Developer + Frontend Tester | Confirmed defects with repro, severity, expected vs. actual, suggested fix |
| [`errors.md`](./errors.md) | Senior Developer | Error-handling & resilience gaps (non-fatal but worth hardening) |
| [`features.md`](./features.md) | Frontend Tester | Evidence-backed list of what works, including smoke-test results |
| [`enhancements.md`](./enhancements.md) | UI/UX Designer | Prioritized UX/design/accessibility/performance improvements |

## Severity legend

| Level | Meaning |
| --- | --- |
| **High** | Wrong behavior users can hit in normal use; data loss or misleading output |
| **Medium** | Wrong/unexpected behavior in a narrower or edge path; degraded UX |
| **Low** | Cosmetic, robustness, or code-health issue; latent bug |

## Notes & caveats

- AI provider output was **not** exercised against a live TokenRouter key in this
  pass; the rule-based fallback was the execution path tested. The streaming
  field-reveal plumbing is shared, so its shape was verified end-to-end via curl.
- Testing was done in a local development environment; cloud (Turso/Mailgun)
  auth flows were verified against their code paths and the unit suite, not a
  live send/verify round-trip.
- The initial pass was documentation only; the findings were then implemented in
  a follow-up round (see the status note above). Each document marks its entries
  with their implementation status (`— ✅ FIXED`, with the applied change
  described inline).
