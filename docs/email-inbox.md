# Pro Email Inbox (Mailgun)

The Pro inbox runs **entirely on Mailgun** — no Gmail/Outlook OAuth, no stored
provider tokens.

- **Inbound**: each Pro user gets a private forward address
  `{slug}@<INBOUND_DOMAIN>`. Emails forwarded there are signature-verified,
  rate-limited, and analyzed automatically (see `src/lib/inbound.ts` and
  `POST /api/mailgun/inbound`).
- **Outbound**: replies drafted in the reply panel are sent through the
  Mailgun Messages API from the app's own domain (`src/app/api/inbox/send`).

## Required env vars

| Variable | Purpose |
| --- | --- |
| `MAILGUN_API_KEY` | Private API key (sending + inbound signature fallback) |
| `MAILGUN_DOMAIN` | Verified sending domain (replies go out from here) |
| `MAILGUN_FROM` | Optional From override; defaults to `no-reply@<domain>` |
| `MAILGUN_BASE_URL` | Optional API base incl `/v3` (EU accounts: `https://api.eu.mailgun.net/v3`) |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Optional; verifies inbound webhooks (falls back to `MAILGUN_API_KEY`) |
| `INBOUND_DOMAIN` | Domain for the forward-to-TaskMind address (default `in.taskmind.app`) |

All of these live in `.env.example` under "Email inbox (Pro, via Mailgun)".

## Setting up the receive route

1. **Verify a domain** in Mailgun (Sending → Domains). For development you can
   use the sandbox domain, but it only delivers to recipients authorized in the
   Mailgun dashboard.
2. **Create a receive route** (Receiving → Routes → Create Route):
   - **Expression**: `match_recipient(".*@<INBOUND_DOMAIN>")` — i.e. catch-all
     for `*@<INBOUND_DOMAIN>` so every per-user slug arrives here.
   - **Destination**: `POST` to
     `https://<NEXT_PUBLIC_APP_URL>/api/mailgun/inbound`
     (e.g. `https://taskmind.app/api/mailgun/inbound`).
   - **Priority/Action**: forward (store-and-notify is fine; the route only
     needs the HTTP POST).
3. **Point `INBOUND_DOMAIN`** at the same domain so the address shown in the
   Inbox/Settings pages matches the receive route.

The user's address is created lazily: opening the Inbox page (or the
Settings → Email inbox card) inserts the slug into `inbound_routes` and returns
the address to copy.

## Security & abuse protection

- **Signature verification**: every webhook is HMAC-SHA256 checked
  (`timestamp + token`, key = `MAILGUN_WEBHOOK_SIGNING_KEY` or
  `MAILGUN_API_KEY`) within a 15-minute freshness window to block replays.
- **Per-address rate limit**: 60 inbound emails per hour per slug.
- **Loop protection**: auto-replies (`Auto-Submitted`, `Precedence: auto_reply`,
  `X-AutoReply`, …) and the app's own transactional senders are dropped before
  analysis.
- **No auto-reply**: inbound mail is analyzed and stored; nothing is emailed
  back unless the user drafts + confirms a reply.

## Troubleshooting

- **401 on webhooks**: `MAILGUN_WEBHOOK_SIGNING_KEY`/`MAILGUN_API_KEY` mismatch
  or a stale clock — signatures expire after 15 minutes.
- **404 on inbound**: the slug isn't in `inbound_routes` (user never opened
  Inbox/Settings) or the address domain doesn't match `INBOUND_DOMAIN`.
- **Replies fail with 409**: `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` aren't set —
  the Send button is hidden until `isMailgunConfigured()` is true.
