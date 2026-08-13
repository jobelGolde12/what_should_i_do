# Pro Plan — 06 · Email Inbox Integration

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Turns TaskMind into an actual inbox assistant. Pro users get a **private
forward-to-TaskMind address** (email arrives → auto-analyzed), and can **connect
Gmail/Outlook** to analyze recent messages and **reply from TaskMind** using the
draft engine from plan `01`. This is the "AI generated response when the user
attached an email" feature taken to its natural end state.

## Where it fits today

- Inbound/outbound mail: only Mailgun for transactional emails
  (`src/lib/mailgun.ts`, `src/app/api/auth/*`). No per-user inbound addresses, no
  IMAP/Gmail API, no OAuth.
- Reply drafting: plan `01-ai-reply-drafting.md` (depends on this plan's "send").

## Depends on

- `01-ai-reply-drafting.md` (drafts to send)
- `00-entitlements-and-gating.md` (Pro-only)
- `04-cloud-sync-multi-device.md` (persist analyzed emails like history)

---

## Tasks

### 1. Forward-to-TaskMind address

- [x] Add a per-user inbound route via Mailgun (receive routes): derive
  `{slug}@in.taskmind.app` from the user id; store the mapping in
  `user_settings` or a new `inbound_addresses` table.
- [x] Add `src/app/api/mailgun/inbound/route.ts` (webhook, signature-verified):
  parse sender/subject/body/attachments, create an `AnalysisRecord`, run the
  analysis (batch or single), and save to the user's history (schema tables).
- [x] Handle verification loop protection and spam/unsubscribe headers; respect
  the user's notification prefs (don't email back unless asked).

### 2. Connect Gmail / Outlook

- [x] Add OAuth routes `/api/integrations/gmail/connect` (+ Outlook) with
  minimal scopes (read messages, send mail), a state nonce, and PKCE.
- [x] Encrypt and store refresh tokens (Turso `integrations` table, value
  encrypted with an env secret — never plaintext).
- [x] Add "Analyze from inbox": list the N most recent messages (subject,
  snippet, sender, date), select one (or several → batch), and run analysis.
- [x] Consent/revoke UI in `SettingsView.tsx` ("Connected accounts" card) with
  a disconnect action that deletes tokens.

### 3. Reply & send

- [x] Extend the reply panel (plan `01`) with **Send** when a connected account
  exists: compose subject (re: original), send via the provider API (Gmail
  `gmail.users.messages.send` / Outlook SendMail), and record the send in
  history with a "replied" marker.
- [x] Never auto-send; always a two-step confirm with an editable draft.

### 4. Inbox UI

- [x] Add an "Inbox" entry in `Sidebar`/nav (see `src/lib/nav.ts`) and a
  `src/components/inbox/*` surface listing analyzed forwarded emails and
  connected-account messages with status (analyzed / not).
- [x] Search/filter the inbox reusing QuickSearch primitives.

### 5. Security review

- [x] Token encryption at rest, scoped OAuth, per-user isolation on all routes,
  rate limiting on inbound parsing (protect against abuse of forward address).
- [x] Update `docs/security.md` endpoint inventory.

### 6. Tests

- [x] Unit: `tests/inbound.test.ts` — slug derivation, webhook signature check,
  message → record mapping, attachment extraction reuse.
- [x] Unit: `tests/integrations.test.ts` — token encrypt/decrypt, revoke.
- [x] Route tests: OAuth handshake (mocked provider), 401/403, rate limits.

## Definition of done

- [x] Email sent to a Pro user's forward address appears analyzed in their
  history/inbox.
- [x] Gmail/Outlook connect lists messages, analyzes them, and can send a reply
  draft with explicit user confirmation.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
