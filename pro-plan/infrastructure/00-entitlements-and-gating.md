# Pro Plan — 00 · Entitlements, Limits & Gating

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's needed

The enforcement layer that decides **who gets what**. It reads the subscription
state produced by `00-subscription-billing.md` and exposes: a typed plan object,
per-tier limits, server-side guards for Pro-only routes, client-side gating, and
usage metering. Every other plan in this folder consumes this module — build it
first.

## Where it fits today

Today everything is free and local; the only gating is feature-flag style
(`src/lib/features.ts`) and per-IP rate limits (`src/lib/rateLimit.ts`). There is
no per-user limit table, no plan type, and no `usePlan` hook. This plan adds the
`src/lib/pro/*` modules and a `pro_usage` table.

## Depends on

- `00-subscription-billing.md` (plan state source) — but design the module
  against a `planFor(user)` interface so it can be mocked before billing ships.

---

## Tasks

### 1. Plan model & helpers

- [x] Create `src/lib/pro/plans.ts` (shared with billing): `PlanTier`,
  `planLimits: Record<PlanTier, PlanLimits>` (analyses/day, max file bytes, max
  message chars, translations/day, batch size, sync enabled, conversions/month,
  ad-free).
- [x] Create `src/lib/pro/entitlements.ts`:
  - [x] `planFor(user: AuthUser | null): PlanTier` — `"pro"` only when the user's
    subscription status is `active|trialing`, else `"free"`.
  - [x] `isPro(user)` helper.
  - [x] `limitsFor(user): PlanLimits`.
  - [x] `requirePro(request)` server helper that throws/returns 403 for non-Pro
    (mirrors `getClientIp`/`rateLimit` pattern).
- [x] Client `usePlan()` hook returning `{ tier, isPro, limits }` backed by
  AuthContext's plan state.

### 2. Server-side enforcement in existing routes

- [x] Gate `POST /api/translate` and `POST /api/analyze/stream` with per-user
  daily counters: free = `plans.free` limits, pro = higher/unlimited.
- [x] Enforce max message length from `limitsFor` in the analyze routes (free cap
  lower than Pro).
- [x] Enforce max upload bytes in `extractTextFromFile` based on plan
  (`InputArea.tsx` reads limits from `usePlan`).
- [x] Add `requirePro` to Pro-only endpoints as features land (reply, convert,
  batch, sync, exports).

### 3. Usage metering

- [x] Add `pro_usage` table to `src/lib/db/schema.ts`
  (`user_id`, `metric`, `window_start`, `count`, PK(user_id, metric,
  window_start)); bump `SCHEMA_VERSION`; migrate.
- [x] Add `src/lib/pro/usage.ts`: `incrementUsage(userId, metric)`,
  `usageCount(userId, metric, window)` with a fixed daily window (mirror
  `src/lib/rateLimit.ts` semantics).
- [x] Wire counters into analyze/translate/convert/batch routes.

### 4. Client-side gating & upsells

- [x] Add `ProBadge` / lock indicator in `src/components/ui/` and a reusable
  `UpgradeCta` (button + small modal) linking to `/settings#billing`.
- [x] Apply gating wrappers where Pro features appear (each feature plan
  specifies its exact surfaces).
- [x] Add an "Upgrade to Pro" card in Settings and a non-intrusive banner on the
  dashboard for free users who hit a limit (uses `toast.ts`).

### 5. Limits UX

- [x] When a free user hits a limit, return a machine-readable
  `code: "LIMIT_REACHED"` from APIs and render the upgrade CTA instead of a raw
  error (reuse the `AuthError`/`code` pattern from `src/lib/errors.ts`).

### 6. Tests

- [x] Unit: `tests/pro/entitlements.test.ts` — planFor/isPro/limitsFor across
  statuses (active, trialing, past_due, canceled, anon).
- [x] Unit: `tests/pro/usage.test.ts` — increment/count windows.
- [x] Route tests: free user blocked on a Pro endpoint (403) with a clear code;
  limits returned to the client for upsell copy.

## Definition of done

- [x] Free tier behaves exactly as today; Pro tier can be dry-run by flipping a
  user's plan to `pro` in the DB (no Stripe needed) and unlocking a feature.
- [x] Usage counters and limits are enforced server-side; the client never trusts
  `isPro` alone.
- [x] Upsell UI exists and points at billing.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
