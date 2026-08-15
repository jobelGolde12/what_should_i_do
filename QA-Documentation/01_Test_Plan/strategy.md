# QA Test Strategy — TaskMind ("what-should-i-do")

**Date:** 2026-08-15
**Author:** QA Engineering
**App:** Next.js 14.2.35 App Router · Turso/libSQL · TokenRouter→OpenRouter AI cascade · Mailgun · Stripe

---

## 1. Objectives

Verify TaskMind against its claimed behavior across five axes:

1. **Functional** — registration/login, analysis (stream/batch), conversion, inbox, reminders, sync, sharing, settings, billing gating.
2. **Security** — static audit of all 34 API routes + runtime probes (auth, rate limiting, IDOR, injection, tamper resistance).
3. **Performance & build** — `next build` output, bundle sizes, first-load JS, cold-start behavior.
4. **UI/UX & accessibility** — WCAG 2.x static audit of all client components, focus/keyboard, contrast, semantics, responsive layout.
5. **Dependencies** — `npm audit`, `npm outdated`.

## 2. Approach

- **Black-box API testing** (curl) against a locally built production server (`next start`) and a dev server (`next dev`), on `127.0.0.1:3000` / `:3001`.
- **Isolated environment**: local libSQL file DB, empty/invalid third-party credentials so no real Mailgun email, Stripe charge, or paid AI call is ever made.
- **Static source audit** for security and accessibility where runtime probing is unsafe or impossible.
- **Never fixes bugs** — documents them for the engineering team.

## 3. Test Environment Matrix

| Environment | Purpose | Verified |
|---|---|---|
| Unit tests (`npm test`, vitest) | Baseline regression (18 files, 243 tests) | ✅ All pass |
| Typecheck (`npm run typecheck`) | TS correctness | ✅ Clean |
| Lint (`npm run lint`) | ESLint | ✅ Clean |
| Production build (`npm run build`) | Build integrity + bundle sizes | ✅ Exit 0, 39 static pages |
| Dev server (`npm run dev -p 3001`) | Dev-mode-only behaviors, register flow, IDOR checks | ✅ |
| Prod server (`npm run start`) | Full black-box functional run | ✅ |

## 4. Data Strategy

- **Test accounts**: `qa.user@example.com` (Pro), `ua@example.com` / `ub@example.com` (Pro, for cross-user isolation), all created in the local file DB with test-only passwords.
- **Pro entitlement** granted directly in the local DB `subscriptions` table (mirrors what a Stripe webhook would set).
- **Sample content**: business emails ("submit the report by Friday"), multi-line messages, XSS/SQLi probes, malformed JSON, oversized payloads.
- **Blocked by design** (documented as Blocked, never exercised):
  - Stripe checkout / portal / webhook (Stripe unconfigured → `503 BILLING_UNAVAILABLE`).
  - Real Mailgun delivery (Mailgun empty → register auto-verifies in dev; prod register returns 503 by design).
  - Paid AI models (fallback rules engine used; TokenRouter key cleared).

## 5. Risk-Based Prioritization

| Priority | Area | Why |
|---|---|---|
| P0 | Auth (register/login/session), Pro gating | Direct access control |
| P0 | inbox/send (email relay) | Spam/abuse vector |
| P0 | Rate limiting behavior | DoS/shared-bucket availability |
| P1 | Analysis pipeline (stream/batch/summarize/translate) | Core product value |
| P1 | Convert (file parsing) | Memory-heavy, dev-only crash |
| P1 | Share links (crypto) | Privacy feature |
| P1 | Sync (users/me PUT vs /sync) | Data-integrity risk |
| P2 | Inbox forwarding, reminders, digest, ICS | Secondary flows |
| P2 | Static pages, metadata, robots/sitemap | Low risk but user-facing |
| P3 | UI/UX/a11y | Quality bar, not correctness |

## 6. Exit Criteria

- All P0/P1 test cases executed with a recorded Pass/Fail/Blocked result.
- Every confirmed defect captured as a numbered bug report with reproduction steps and file references.
- Security audit covers all 34 API routes and yields a verdict for each finding.
- Build/performance and dependency scans completed.
- Final verdict written with go/no-go recommendation.

## 7. Deliverables

```
QA-Documentation/
├── 01_Test_Plan/        strategy, scope, environment setup
├── 02_Functional_Testing/  test cases, execution results, bug reports
├── 03_Security_Audit/   vulnerability assessment, dependency scan
├── 04_Performance_Analysis/ build analysis, runtime bottlenecks
├── 05_UI_UX_Review/     accessibility report, responsiveness review
└── 06_Summary/          final verdict
```
