# TaskMind — Pro Plan (feature roadmap)

Detailed, executable plan for the **Pro (paid) tier** of TaskMind. Each feature
lives in its own file with a separate section per task; every section contains
checkboxes to tick as the work is completed.

The app today is **local-first and free**: analysis, deadlines, urgency, history,
board, templates, quick search, share links, translation, and file extraction all
run client-side (with an optional free account for Turso sync and Mailgun-based
email). There is **no billing or plan concept in the code yet**, so the two
infrastructure plans (billing + entitlements) must land first — every Pro feature
depends on them for gating, enforcement, and upsell.

## How to use this plan

- Open a feature file, work a section top-to-bottom, and tick each `- [ ]` box as
  the step is done.
- When all boxes in a section are ticked, mark the section's status (`[x] In
  progress` → `[x] Done`) and, finally, the file's top-level `Status`.
- Keep changes small and commit per section so each box maps to a real commit.

## Feature index

### Infrastructure (must ship first — everything gates on these)

| File | Scope | Depends on |
| --- | --- | --- |
| [`infrastructure/00-subscription-billing.md`](./infrastructure/00-subscription-billing.md) | Stripe billing: checkout, subscriptions, webhooks, invoices, portal | — |
| [`infrastructure/00-entitlements-and-gating.md`](./infrastructure/00-entitlements-and-gating.md) | Plan detection, per-tier limits, server + UI gating, usage metering, upsells | `00-subscription-billing` |

### Pro features

| File | Scope | Depends on |
| --- | --- | --- |
| [`features/01-ai-reply-drafting.md`](./features/01-ai-reply-drafting.md) | AI-generated draft replies for an attached email/message (tone, regenerate, copy) | entitlements; `01` core analysis |
| [`features/02-document-conversion.md`](./features/02-document-conversion.md) | Convert uploaded files: PDF→DOCX, DOCX→PDF, text/images→PDF | entitlements |
| [`features/03-unlimited-batch-analysis.md`](./features/03-unlimited-batch-analysis.md) | Higher quotas, batch/multi-message analysis, higher-quality model tier | entitlements; billing |
| [`features/04-cloud-sync-multi-device.md`](./features/04-cloud-sync-multi-device.md) | Structured cloud sync + backup across devices | entitlements; auth |
| [`features/05-calendar-reminders-digest.md`](./features/05-calendar-reminders-digest.md) | One-click calendar add, deadline reminders, weekly digest email | entitlements; mailgun |
| [`features/06-email-inbox-integration.md`](./features/06-email-inbox-integration.md) | Forward-to-TaskMind inbox (Mailgun), auto-analyze, reply via Mailgun | `01`, `04`, entitlements; mailgun |
| [`features/07-exports-reports-analytics.md`](./features/07-exports-reports-analytics.md) | PDF/Word/CSV exports + productivity analytics & monthly report | `02`, entitlements |
| [`features/08-custom-workflows-templates.md`](./features/08-custom-workflows-templates.md) | Template variables/fields, tags, automation rules | entitlements |
| [`features/09-priority-support-perks.md`](./features/09-priority-support-perks.md) | Ad-free, higher rate limits, priority support, early access | entitlements; billing |

## Recommended execution order

1. **Phase 0 — enablement:** `00-entitlements-and-gating` → `00-subscription-billing`.
   Ship a working Free tier with "Upgrade to Pro" plumbing and a mocked/dry-run
   Pro gate before building real features on top.
2. **Phase 1 — core Pro value:** `01-ai-reply-drafting` → `02-document-conversion`
   → `03-unlimited-batch-analysis`.
3. **Phase 2 — retention:** `04-cloud-sync-multi-device` → `05-calendar-reminders-digest`
   → `07-exports-reports-analytics`.
4. **Phase 3 — advanced:** `06-email-inbox-integration` → `08-custom-workflows-templates`
   → `09-priority-support-perks`.

## Cross-cutting requirements for every feature

- **Gating:** a feature must be locked unless `usePlan().isPro` (see entitlements).
- **Security:** Pro-only API routes check the session server-side (never trust the
  client); reuse `src/lib/rateLimit.ts` and size limits; see `docs/security.md`.
- **Privacy:** Pro features that store user data (sync, inbox) must use the same
  local-first posture — data stays in the user's control, exportable at any time.
- **Testing:** each plan lists unit/integration tests; keep `npm test` green and
  cover the new `src/lib/pro/*` modules.
- **Observability:** log billing events and entitlement checks (see `src/lib/log.ts`).

## Current-state references

- **Analysis:** `src/app/actions/analyzeText.ts`, `src/app/api/analyze/stream/route.ts`,
  `src/lib/ai.ts`, `src/lib/prompts.ts`, `src/lib/analyzeRules.ts`
- **Files:** `src/components/input/InputArea.tsx` (`extractTextFromFile`:
  txt/pdf/docx/OCR via `pdfjs-dist`, `mammoth`, `tesseract.js`; 10 MB cap)
- **Results:** `src/components/results/ResultsPanel.tsx`, `DashboardHome.tsx`
- **Data:** `src/context/TaskContext.tsx` (localStorage), `src/context/AuthContext.tsx`
  (sync via `/api/users/me`), `src/lib/db/schema.ts` (Turso tables incl.
  `analyses`, `board_items`, `templates`, `user_settings`)
- **Deadlines/ICS:** `src/lib/deadline.ts`, `src/lib/ics.ts`
- **Ads:** `src/lib/ads.ts`, `src/components/layout/AdsRail.tsx`
- **Rate limits:** `src/lib/rateLimit.ts`
- **Auth/email:** `src/app/api/auth/*`, `src/lib/mailgun.ts`
