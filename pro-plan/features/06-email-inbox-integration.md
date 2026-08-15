# Pro Plan — 06 · Email Inbox Integration

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Turns TaskMind into an actual inbox assistant. Pro users get a **private
forward-to-TaskMind address** (email arrives → auto-analyzed) and can **reply
from TaskMind** using the draft engine from plan `01`.

> **Design note (current):** the inbox runs entirely on **Mailgun**. Email
> arrives via the forward-to-TaskMind receive route and replies go out through
> the app's own Mailgun domain. The earlier Gmail/Outlook OAuth connect
> (scoped OAuth + PKCE, token encryption) has been **removed** — no third-party
> OAuth scopes, no stored provider tokens.

## Where it fits today

- Inbound/outbound mail: Mailgun for transactional emails and the inbox
  (`src/lib/mailgun.ts`, `src/lib/inbound.ts`,
  `src/app/api/mailgun/inbound/route.ts`, `src/app/api/auth/*`).
- Reply drafting: plan `01-ai-reply-drafting.md` (depends on this plan's
  "send").

## Depends on

- `01-ai-reply-drafting.md` (drafts to send)
- `00-entitlements-and-gating.md` (Pro-only)
- `04-cloud-sync-multi-device.md` (persist analyzed emails like history)

---

## Tasks

### 1. Forward-to-TaskMind address (Mailgun)

- [x] Add a per-user inbound route via Mailgun (receive routes): derive
  `{slug}@in.taskmind.app` from the user id; store the mapping in the
  `inbound_routes` table.
- [x] Add `src/app/api/mailgun/inbound/route.ts` (webhook, signature-verified):
  parse sender/subject/body/attachments, create an `AnalysisRecord`, run the
  analysis, and save to the user's history + inbox (schema tables).
- [x] Handle verification loop protection and spam/unsubscribe headers; respect
  the user's notification prefs (don't email back unless asked).

### 2. Reply & send (via Mailgun)

- [x] Extend the reply panel (plan `01`) with **Send**: compose subject
  (re: original), send through Mailgun (`src/lib/mailgun.ts`), and record the
  send in history with a "replied" marker.
- [x] Never auto-send; always a two-step confirm with an editable draft.

### 3. Inbox UI

- [x] Add an "Inbox" entry in `Sidebar`/nav (see `src/lib/nav.ts`) and a
  `src/components/inbox/*` surface listing analyzed forwarded emails with
  status (analyzed / replied).
- [x] Search/filter the inbox reusing QuickSearch primitives.

### 4. Removed: Gmail / Outlook connect

- [x] ~~OAuth routes `/api/integrations/gmail/connect` (+ Outlook), state
  nonce, PKCE, encrypted refresh tokens~~ — **removed** (Mailgun-only).
- [x] ~~"Analyze from inbox" / live provider sync~~ — **removed**.
- [x] ~~Consent/revoke UI in Settings~~ — replaced by the forward-address card.

### 5. Security review

- [x] Inbound webhook HMAC verification (15-min window), rate limiting per
  slug (protect against abuse of forward address), loop/auto-reply protection,
  per-user isolation on all routes.
- [x] Update `docs/security.md` endpoint inventory (no OAuth endpoints).

### 6. Tests

- [x] Unit: `tests/inbound.test.ts` — slug derivation, webhook signature check,
  message → record mapping, attachment extraction reuse.
- [x] Route tests: forward address gating (401/403), Mailgun send failures
  (409 when unconfigured, 502 on service error).

## Definition of done

- [x] Email sent to a Pro user's forward address appears analyzed in their
  history/inbox.
- [x] Replies can be drafted and sent via Mailgun with explicit user
  confirmation (no auto-send).
- [x] No Gmail/Outlook OAuth code, env vars, or stored tokens remain.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
