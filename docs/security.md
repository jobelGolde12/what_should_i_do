# TaskMind Security & Privacy Checklist

Living document for the privacy/security model (Feature 24). Status reflects
the state of the repo at the last review. Run checks with:

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run security:audit   # npm audit --omit=dev
```

## Architecture

- **Local-first**: history, templates, board, theme live in `localStorage`
  (`src/lib/storage.ts`). Nothing is stored server-side except optional synced
  account data.
- **Transmission**: only the text you analyze is sent to the configured AI
  provider (TokenRouter, OpenAI-compatible) via `/api/analyze/stream` or the
  `analyzeText` server action (`src/lib/ai.ts`). Translation sends the summary
  to MyMemory. Input text is never logged.
- **Auth & Database** (Phase 1-3): scrypt password hashing with timing-safe
  compare, HMAC-signed HttpOnly/SameSite session cookies (`taskmind_session`,
  30-day expiry), email verification via Mailgun API, single-use signed tokens
  stored as SHA-256 hashes, password reset flow, and Turso libSQL SQL persistence
  with relational schema (`users`, `analyses`, `board_items`, `templates`, `user_settings`).
- **Share links**: base64-encoded payload embedded in the URL. Not encrypted,
  no expiry. `includeInput`/`sensitive` options control whether raw input is
  embedded and shown.

## Endpoint inventory & controls

| Endpoint | Auth | Rate limit | Size limit | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/analyze/stream` | none | 15/min/IP | 20,000 chars (413) | SSE; falls back to rule-based |
| `POST /api/summarize` | none | 10/min/IP | 20,000 chars (413) | offline model + extractive fallback |
| `POST /api/translate` | none | 30/min/IP | chunked 480/sentence | cached |
| `POST /api/auth/login` | — | 10/min/IP (DB) | — | blocked if unverified |
| `POST /api/auth/register` | — | 10/min/IP (DB) | — | 409 dup; sends Mailgun email |
| `GET /api/auth/verify` | token | — | — | single-use HMAC token verification |
| `POST /api/auth/resend-verification` | — | 5/min/IP (DB) | — | rate limited email resend |
| `POST /api/auth/forgot-password` | — | 5/min/IP (DB) | — | single-use reset token via email |
| `POST /api/auth/reset-password` | token | 10/min/IP (DB) | — | single-use password update |
| `GET/PUT/DELETE /api/users/me` | session | — | PUT ≤ 2 MB (413) | Turso DB sync; full erasure on DELETE |
| `GET/POST /api/settings/reminders` | session + Pro | — | — | reminder & digest preferences |
| `POST /api/cron/reminders` | `CRON_SECRET` Bearer | — | — | due-reminder email sweep |
| `POST /api/cron/digest` | `CRON_SECRET` Bearer | — | — | weekly digest; `?now` override for tests |
| `POST /api/mailgun/inbound` | Mailgun HMAC (15-min window) | 60/hr per slug (in-memory) | — | forward-to-TaskMind; skips auto-replies + transactional senders |
| `GET /api/inbox` | session + Pro | — | — | stored inbox messages (no bodies) |
| `GET /api/inbox/forward` | session + Pro | — | — | private forward address for the user |
| `GET /api/inbox/context` | session + Pro | — | — | reply To/Subject for an analysis |
| `POST /api/inbox/analyze` | session + Pro | — | — | analyze a provider message; creates history + inbox row |
| `POST /api/inbox/send` | session + Pro | — | body ≤ 100k | explicit two-step confirm (UI); marks inbox replied |
| `GET /api/inbox/sync` | session + Pro | — | — | live list of recent provider messages (metadata) |
| `GET /api/integrations` | session + Pro | — | — | connected providers (no tokens exposed) |
| `GET /api/integrations/:provider/connect` | session + Pro | — | — | OAuth start: state nonce + PKCE, 10-min TTL |
| `GET /api/integrations/:provider/callback` | session + state-bound | — | — | OAuth exchange; single-use state |
| `DELETE /api/integrations/:provider` | session + Pro | — | — | disconnect + delete encrypted tokens |
| `/api/debug/*` | `ADMIN_TOKEN` Bearer (prod) | — | 20k input | 404 unless configured in prod |

Rate limiting for auth operations uses shared DB-backed fixed-window counting (`src/lib/rateLimitDb.ts`)
persisted to Turso, ensuring rate limits hold across multi-instance deployments.

## What is hardened (status)

- [x] **No XSS from model output**: all AI/streamed output is rendered as React
  text; the previous `dangerouslySetInnerHTML` was removed (`SummaryText.tsx`).
  Remaining `dangerouslySetInnerHTML` are static JSON-LD + theme script only.
- [x] **Input validation**: text length limits on all public endpoints; SSE/JSON
  error codes are consistent.
- [x] **Auth hashing**: scrypt + HMAC sessions; no plaintext passwords.
- [x] **User data rights**: export (JSON backup), merge, delete account (erasure
  via `DELETE /api/users/me`), and local clear — all in Settings.
- [x] **Consent**: ads only load with explicit consent (`taskmind:ads-consent`),
  revocable in Settings; data-handling notice shown at the point of analysis.
- [x] **Debug routes production-gated** (Feature 21).
- [x] **Legal pages**: `/privacy` and `/terms`, linked from the app footer and
  the analysis screen.
- [x] **Structured logging** (`src/lib/log.ts`): request id + metadata only —
  analyzed text is never logged.
- [x] **Secret handling**: API keys are server-only env vars
  (`TOKENROUTER_API_KEY`, legacy `OPENROUTER_API_KEY*` deprecated); `.env*` and
  `.data/` gitignored.
- [x] **Strict AI output validation**: model output is schema-validated and
  auto-repaired (`src/lib/validateAnalysis.ts`, zod); sanitizes HTML/markdown
  from actions/deadlines/summary; bounded multi-attempt routing with a circuit
  breaker (`src/lib/ai.ts`).
- [x] **Accuracy harness**: `npm run eval` reports precision/recall/exact-match
  over a labeled dataset; `npm test` covers success, bad JSON, 429, 5xx,
  timeout, empty, and quota paths with a mocked provider.
- [x] **OAuth token encryption at rest**: provider access/refresh tokens are
  AES-256-GCM encrypted (`src/lib/integrations.ts`) with
  `INTEGRATION_ENCRYPTION_KEY` (falls back to `AUTH_SECRET` in dev, required in
  prod) before hitting the `integrations` table — never plaintext, and list
  endpoints never expose them.
- [x] **Scoped OAuth + PKCE**: Gmail/Outlook connect uses a state nonce bound to
  the signed-in user (single-use, 10-min TTL in `user_settings`) and PKCE with
  minimal scopes (read/send only). Callbacks require a session.
- [x] **Inbound webhook verification**: the forward-to-TaskMind route
  (`POST /api/mailgun/inbound`) verifies the Mailgun HMAC signature within a
  15-minute window (replay protection), rate-limits per slug, and drops
  auto-replies/transactional senders before analysis.

## Known risks & remediation plan

1. **`next@14.2.35` has known advisories** (DoS, XSS, cache poisoning) fixed in
   `next@15.5.21`. **Priority**: migrate to Next 15 (requires React 19 and the
   async request APIs — a dedicated effort, out of scope for this pass). Until
   then, keep `next` pinned to the newest 14.2.x patch; the flagged routes are
   exercised only by authenticated/same-origin traffic in practice.
2. **`@xenova/transformers` chain** (`onnxruntime-web` → `protobufjs` critical,
   `sharp`, `@xmldom/xmldom`) — used only by the offline `/api/summarize`
   route, which degrades to an extractive fallback if the model cannot load.
   Model files are fetched from a pinned HuggingFace URL, not user input, so the
   attack surface is limited to server-side DoS. `npm audit fix --force` would
   downgrade to `transformers@1.4.2` (breaking) — not applied. Revisit when a
   patched transformers release lands.
3. **`underscore` (via `mammoth`)** — docx extraction only; parser DoS on
   untrusted `.docx`. Consider switching the docx extractor or pinning a patched
   underscore.
4. **Share links do not expire** and are reversible — documented in `/privacy`;
   password/expiry are future work (Feature 15).

## Key rotation & least privilege

- Keys are injected at runtime via env; never hardcode or commit them.
- Use one TokenRouter key per environment if possible; rotate by replacing the
  env value and restarting (circuit-breaker state resets on restart).
- `ADMIN_TOKEN` guards debug routes in production; rotate it like a password.
- `AUTH_SECRET` signs sessions — set a stable, long random value in production;
  rotation invalidates all sessions.
- `INTEGRATION_ENCRYPTION_KEY` encrypts OAuth tokens at rest — set a stable,
  long random value in production; rotation breaks stored tokens (users must
  reconnect), so prefer key rotation alongside a re-auth prompt.

## Data access / audit

- Structured request logs contain request id, endpoint, byte counts, latency —
  never raw text. See `src/lib/log.ts`.
- Sentry/error tracking is not yet integrated; add it without logging text
  (Feature 21 deferral).
