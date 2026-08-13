# Pro Plan — 09 · Priority Support & Pro Perks

**Status:** `[ ]` Not started · `[ ]` In progress · `[ ]` Done

## What it is & why it's Pro

The "softer" Pro benefits that make the paid tier clearly worth it beyond
features: **ad-free** experience, **higher rate limits**, a **priority support
channel**, and **early access** to new features. Small scope, high perceived
value — cheap to ship once entitlements exist.

## Where it fits today

- Ads: `src/lib/ads.ts` (`AD_CLIENT`/`AD_SLOT`, `adsConsented`, consent event) and
  `src/components/layout/AdsRail.tsx` (`AdsRail` + `AdBlock` on the dashboard).
  The opt-in banner was removed; ads still render in the rail when configured.
- Rate limits: per-IP buckets in `src/lib/rateLimit.ts`.
- Support: none beyond `mailgun.ts` transactional email and static docs pages.

## Depends on

- `00-entitlements-and-gating.md` (plan detection)
- `00-subscription-billing.md` (verify Pro status)

---

## Tasks

### 1. Ad-free for Pro

- [ ] In `AdsRail.tsx`, read `usePlan().isPro` and render **no ad slot** for Pro
  users (remove the rail unit and `AdBlock` placeholder on the dashboard).
- [ ] Keep the `AdsRail` column present (or hide it entirely for Pro) — decide
  and document; keep layout stable so removal doesn't shift content.
- [ ] Confirm `adsConsented`/`pushAd` is never triggered for Pro (guard in
  `src/lib/ads.ts` or the rail).

### 2. Higher rate limits

- [ ] Extend `src/lib/rateLimit.ts` (or add `src/lib/pro/entitlements.ts`
  `limitFor(user, action)`) so Pro users get a larger bucket than free for the
  same window (e.g. free 60/min, pro 600/min per IP+user).
- [ ] Apply the per-plan limit in the analyze/translate/convert/export routes.

### 3. Priority support channel

- [ ] Add `src/app/api/support/route.ts` (Pro-only, `requirePro`): contact form
  (subject, message, diagnostic snapshot opt-in) → Mailgun to the support inbox,
  with a "Pro ticket" priority header.
- [ ] Add `src/components/settings/SupportCard.tsx` in Settings for Pro users
  ("Priority support — typically < 24 h") with the form and a link to docs/FAQ.
- [ ] Add an SLA note + email confirmation of the ticket.

### 4. Early access toggles

- [ ] Add an `experiments` settings section (stored in `user_settings`): Pro
  users can opt into unreleased features behind `src/lib/features.ts`-style
  flags before they go live for everyone.

### 5. Pro identity in the app

- [ ] Show a "Pro" badge next to the user in Settings/Sidebar (`usePlan().isPro`)
  with a "Manage subscription" link (billing portal from plan `00`).

### 6. Tests

- [ ] Unit: `tests/pro/perks.test.ts` — per-plan rate bucket resolution.
- [ ] Route tests: ad gating is client-side but assert the API contracts — 403
  support for non-Pro, ticket email payload, rate-limit bucket per plan.

## Definition of done

- [ ] Pro users see no ads; free behavior unchanged.
- [ ] Pro gets a larger rate-limit bucket and a working priority support form
  that emails the support inbox with a Pro marker.
- [ ] Pro badge + early-access toggles present in Settings.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
