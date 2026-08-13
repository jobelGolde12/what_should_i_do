# Pro Plan — 03 · Unlimited & Batch Analysis

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Free users get a conservative daily analysis quota and single-message analysis.
Pro users get **higher (effectively unlimited) quotas, longer messages, a
higher-quality model tier, and batch analysis** — analyze a whole inbox export,
a list of messages, or a pasted conversation in one go, with per-message results.

## Where it fits today

- Analysis: `src/app/actions/analyzeText.ts` (server action + rule fallback),
  `src/app/api/analyze/stream/route.ts` (SSE), `src/lib/ai.ts` (client),
  `src/lib/rateLimit.ts` (per-IP). No per-user quota today.
- **Batch already exists server-side** as `analyzeTextsBatch()` in
  `src/app/actions/analyzeText.ts` — but it is not exposed in the UI or metered.

## Depends on

- `00-entitlements-and-gating.md` (quota + `requirePro`)
- `00-subscription-billing.md` (usage metering)

---

## Tasks

### 1. Quota & limits wiring

- [x] Define Free vs Pro daily analysis limits in `src/lib/pro/plans.ts`
  (e.g. free 10/day, pro 500/day or unlimited) and max message chars
  (free 4k, pro 50k).
- [x] Enforce the daily counter on `POST /api/analyze/stream` and the
  `analyzeText` server action via `src/lib/pro/usage.ts`
  (`incrementUsage(userId, "analyses")`); return `code: "LIMIT_REACHED"` when
  exhausted (upsell copy client-side).
- [x] Enforce max message length from `limitsFor(user)` in both analyze paths
  (413/400 with a clear message).

### 2. Long-message & deep analysis mode

- [x] Add a "Deep analysis" option for Pro in `InputArea` that enables a larger
  token budget and prompt mode (see `src/lib/prompts.ts`) for messages up to the
  Pro char cap.
- [x] Chunk very long inputs within the stream route and merge partial results
  (reuse `src/lib/streamParse.ts` field assembly), so partial fields still reveal
  progressively.
- [x] Gate the option with `usePlan().isPro`.

### 3. Higher-quality model tier

- [x] In `src/lib/ai.ts`, allow a per-plan model selection: Pro uses a stronger
  model id, higher temperature range, and larger `max_tokens` (config via
  `NEXT_PUBLIC_/env` with safe defaults).
- [x] Thread `plan`/model choice from the route/action into `aiClient` so the
  prompt + params differ per tier; keep the same `AnalysisResult` shape so UI is
  unchanged.

### 4. Batch analysis

- [x] Expose `analyzeTextsBatch` through a new `POST /api/analyze/batch` route
  (`requirePro`, size limits, per-user quota) and/or a server action
  `analyzeBatch(inputs: string[])`.
- [x] Add batch input UI: paste multiple messages (blank-line or `---` separated)
  or upload a `.txt`/`.csv` in `InputArea`; parse into messages.
- [x] Add `src/components/results/BatchResults.tsx`: per-message result cards
  (actions, urgency, deadlines), expandable, with "send each to board/history"
  buttons and a combined summary.
- [x] Progress bar + cancel per batch (abort controller per item; reuse
  `StreamCancelledError` semantics).

### 5. Tests

- [x] Unit: `tests/batch.test.ts` — batch parsing (separators, csv), quota
  increment per item, model-tier selection.
- [x] Route tests: 403 non-Pro batch, oversized batch 413, `LIMIT_REACHED`.

## Definition of done

- [x] Pro users analyze long messages and up to N messages per batch with
  per-message results; free quotas and limits are enforced server-side.
- [x] Deep analysis + model tier are active for Pro only.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
