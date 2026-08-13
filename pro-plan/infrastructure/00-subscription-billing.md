# Pro Plan — 00 · Subscription & Billing (Stripe)

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's needed

Adds the billing engine that makes TaskMind a paid product: a **Free** tier and a
**Pro** tier, sold via Stripe (one monthly and one annual Pro price). This plan
does not decide *which* features are Pro (see
`00-entitlements-and-gating.md`); it provides checkout, subscription lifecycle,
webhooks, invoices, and a customer portal.

## Where it fits today

There is **no billing code** today. Accounts are email/password with a Turso
`users` table (`src/lib/db/schema.ts`) and HMAC-signed session cookies. Money,
plan state, and subscription lifecycle all need to be added. This file therefore
touches schema, new API routes, and new `src/lib/pro/*` modules.

## Depends on

- **None.** This can proceed in parallel with entitlements, but entitlements
  consumes its `GET /api/billing/status` output.

---

## Tasks

### 1. Plan catalog & configuration

Define the two-tier catalog in a typed config module so the rest of the app reads
limits from one source of truth (and entitlements reuses it).

- [x] Create `src/lib/pro/plans.ts` with `PlanTier = "free" | "pro"`, display
  names, and per-tier limits (e.g. analyses/day, file size, max message chars,
  translations/day, batch size) as constants.
- [x] Add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`,
  `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`, and `STRIPE_WEBHOOK_SECRET` to
  `.env.example` (documented, no real keys committed).
- [x] Add zod schema (`src/lib/pro/billing.ts`) validating Stripe price IDs and
  the webhook secret at startup; fail fast in dev if missing.

### 2. Stripe client & helpers

- [x] Add `stripe` dependency (`npm i stripe`).
- [x] Create `src/lib/pro/stripe.ts`: lazily instantiated Stripe client,
  typed helpers `createCheckoutSession(user, priceId)`,
  `getSubscription(customerId)`, `createPortalSession(customerId)`,
  `constructWebhookEvent(body, sig)`.

### 3. Schema: subscription state

- [x] Add a `subscriptions` table to `src/lib/db/schema.ts`: `id` (stripe
  subscription id), `user_id`, `stripe_customer_id`, `status`
  (`active|trialing|past_due|canceled|unpaid`), `price_id`, `current_period_end`,
  `plan` (`free|pro`), timestamps; bump `SCHEMA_VERSION` and add the migration.
- [x] Add a `checkout_sessions` table (or column on users) to map a Stripe
  session/customer back to a user before the webhook fires.
- [x] Run `npm run db:migrate` and verify the tables exist.

### 4. Checkout

- [x] Add `src/app/api/billing/checkout/route.ts` (POST, session required):
  validates the user, resolves the requested price, creates a Stripe Checkout
  Session with `success_url`/`cancel_url` and `client_reference_id = user.id`.
- [x] On success return `{ url }`; the client redirects to Stripe.
- [x] Add rate limiting + size limits to the route (mirror `src/lib/rateLimit.ts`).

### 5. Webhooks (single source of truth for plan state)

- [x] Add `src/app/api/billing/webhook/route.ts` (POST) verified with
  `constructWebhookEvent` using `STRIPE_WEBHOOK_SECRET`; reject invalid
  signatures with 400.
- [x] Handle `checkout.session.completed` → create/update `subscriptions` row +
  `stripe_customer_id`, set user plan to `pro`.
- [x] Handle `customer.subscription.updated` → sync status/period; downgrade to
  `free` when `canceled`/`unpaid` (keep data, drop Pro access).
- [x] Handle `customer.subscription.deleted` and `invoice.paid` /
  `invoice.payment_failed` (last-payment-failed → send a payment-failure email
  via `src/lib/mailgun.ts`).
- [x] Store raw events (or `event.id`) to make webhook handling idempotent
  (dedupe table `webhook_events`).

### 6. Plan status API + client state

- [x] Add `GET /api/billing/status` returning `{ plan, status, currentPeriodEnd,
  renewsAt }` from the DB (fall back to `free` for anon).
- [x] Extend `src/context/AuthContext.tsx` with `plan` / `isPro` derived from
  `/api/billing/status`, refreshed on login and after checkout/webhook.
- [x] Add a small `usePlan()` hook in `src/lib/pro/entitlements.ts` (consumed by
  every feature plan) that reads plan from AuthContext.

### 7. Manage subscription (portal + cancel/upgrade)

- [x] Add `src/app/api/billing/portal/route.ts` (POST, Pro only) returning a
  Stripe Customer Portal session URL.
- [x] Settings UI (`src/components/settings/SettingsView.tsx`): a "Subscription"
  card showing current plan, price, renewal date, and buttons **Upgrade to Pro**
  / **Manage subscription** (portal) / **Downgrade**.
- [x] Free users see the upgrade card; Pro users see portal link and next
  renewal date.

### 8. Invoices & receipts

- [x] Enable hosted invoice URLs in Stripe and surface a "Receipts" link in the
  Settings subscription card (via portal).
- [x] Optionally email an invoice-paid notification using `src/lib/mailgun.ts`
  when `invoice.payment_succeeded` arrives.

### 9. Tests

- [x] Unit: `tests/pro/billing.test.ts` — price validation, helper mocks,
  webhook payload construction.
- [x] Integration: webhook handler with signed fixtures (completed/updated/
  deleted/payment-failed) using a mocked Stripe client; assert DB state changes.
- [x] Rate-limit + auth rejection tests for checkout/status/portal routes.

## Definition of done

- [x] A user can check out for Pro, get redirected back, and see `plan: "pro"`
  in Settings and via `GET /api/billing/status`.
- [x] Upgrade, cancel/downgrade, and portal navigation work end-to-end with
  Stripe test mode.
- [x] Webhooks are signature-verified and idempotent; payment failure notifies
  the user by email.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
