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
  providers (TokenRouter primary, OpenRouter secondary fallback — both
  OpenAI-compatible) via `/api/analyze/stream` or the `analyzeText` server
  action (`src/lib/ai.ts`). Translation sends the summary to MyMemory. Input
  text is never logged.
- **Auth & Database** (Phase 1-3): scrypt password hashing with timing-safe
  compare, HMAC-signed HttpOnly/SameSite session cookies (`taskmind_session`,
  30-day expiry) stamped with the user's `auth_version`, email verification via
  Mailgun API using **stateless HMAC-signed tokens** (no token hashes stored in
  the DB), password reset flow, and Turso libSQL SQL persistence with
  relational schema (`users`, `analyses`, `board_items`, `templates`,
  `user_settings`). Any security event (link issue, token consume, password
  change) bumps `users.auth_version`, which revokes outstanding tokens *and*
  signed-in sessions (checked on every authed read via
  `src/lib/auth/cookies.ts`). PII: emails are never written to logs — only a
  stable SHA-256 digest (`maskEmail` in `src/lib/log.ts`).
- **Share links**: encrypted tokens (AES-256-GCM, `src/lib/share.ts`) created
  via `POST /api/share` (rate-limited) and decrypted server-side on
  `/share/[id]`; the plaintext is never embedded in the URL. A `sensitive`
  payload is stripped of raw input before it reaches the browser. Tokens
  expire after 30 days (`SHARE_TTL_MS`). The legacy pre-encryption base64
  decode path was removed (SEC-12) — no valid links predate the 30-day window,
  so no backward-compatible decode is shipped.

## Endpoint inventory & controls

| Endpoint | Auth | Rate limit | Size limit | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/analyze/stream` | none | 15/min/IP | 20,000 chars (413) | SSE; falls back to rule-based |
| `POST /api/summarize` | none | 10/min/IP | 20,000 chars (413) | offline model + extractive fallback |
| `POST /api/translate` | none | 30/min/IP | chunked 480/sentence | cached |
| `POST /api/share` | none | 60/min/IP (DB) | payload ≤ 20k input (400) | encrypts share token AES-256-GCM |
| `POST /api/auth/login` | — | 10/min/IP (DB) | — | blocked if unverified |
| `POST /api/auth/register` | — | 10/min/IP (DB) | — | 409 dup; sends Mailgun email |
| `GET /api/auth/verify` | token | — | — | stateless version-stamped HMAC token (single-use via `auth_version` bump) |
| `POST /api/auth/resend-verification` | — | 5/min/IP (DB) | — | rate limited email resend |
| `POST /api/auth/forgot-password` | — | 5/min/IP (DB) | — | stateless version-stamped reset token via email |
| `POST /api/auth/reset-password` | token | 10/min/IP (DB) | — | stateless version-stamped password update |
| `GET/PUT/DELETE /api/users/me` | session | — | PUT ≤ 2 MB (413) | Turso DB sync; strict per-record validation (invalid records rejected whole-batch); full erasure on DELETE |
| `GET/POST /api/settings/reminders` | session + Pro | — | — | reminder & digest preferences |
| `POST /api/cron/reminders` | `CRON_SECRET` Bearer | — | — | due-reminder email sweep |
| `POST /api/cron/digest` | `CRON_SECRET` Bearer | — | — | weekly digest; `?now` override for tests |
| `POST /api/mailgun/inbound` | Mailgun HMAC (15-min window) | 60/hr per slug (in-memory) | — | forward-to-TaskMind; skips auto-replies + transactional senders |
| `GET /api/inbox` | session + Pro | — | — | stored inbox messages (no bodies) |
| `GET /api/inbox/forward` | session + Pro | — | — | private forward address for the user |
| `GET /api/inbox/context` | session + Pro | — | — | reply To/Subject for an analysis (Mailgun send) |
| `POST /api/inbox/send` | session + Pro | — | body ≤ 100k | sends via Mailgun; explicit two-step confirm (UI); marks inbox replied |
| `/api/debug/*` | `ADMIN_TOKEN` Bearer (prod) | — | 20k input | 404 unless configured in prod |

Rate limiting for auth operations uses shared DB-backed fixed-window counting (`src/lib/rateLimitDb.ts`)
persisted to Turso, ensuring rate limits hold across multi-instance deployments.

## What is hardened (status)

- [x] **No XSS from model output**: all AI/streamed output is rendered as React
  text; the previous `dangerouslySetInnerHTML` was removed (`SummaryText.tsx`).
  Remaining `dangerouslySetInnerHTML` are static JSON-LD + theme script only.
- [x] **Input validation**: text length limits on all public endpoints; SSE/JSON
  error codes are consistent. `PUT /api/users/me` strictly validates every
  synced record against an allow-list (`src/lib/auth/validation.ts`) and
  rejects the whole batch if any record is malformed.
- [x] **Auth hashing**: scrypt + HMAC sessions; no plaintext passwords.
- [x] **Session revocation**: password changes bump `users.auth_version`;
  previously-issued sessions and verification/reset tokens are rejected.
- [x] **Stateless email tokens**: verification/reset links are HMAC-signed and
  version-stamped; nothing is stored server-side, and replays/rotations fail.
- [x] **No PII in logs**: email addresses are hashed (`maskEmail`) before any
  log write; request logs carry request id + metadata only.
- [x] **User data rights**: export (JSON backup), merge, delete account (erasure
  via `DELETE /api/users/me`), and local clear — all in Settings.
- [x] **Consent**: ads only load with explicit consent (`taskmind:ads-consent`),
  revocable in Settings; data-handling notice shown at the point of analysis.
- [x] **Debug routes production-gated** (Feature 21).
- [x] **Legal pages**: `/privacy` and `/terms`, linked from the app footer and
  the analysis screen.
- [x] **Structured logging** (`src/lib/log.ts`): request id + metadata only —
  analyzed text and raw emails are never logged.
- [x] **Secret handling**: API keys are server-only env vars
  (`TOKENROUTER_API_KEY` primary, `OPENROUTER_API_KEY` secondary fallback);
  `.env*` and `.data/` gitignored.
- [x] **Strict AI output validation**: model output is schema-validated and
  auto-repaired (`src/lib/validateAnalysis.ts`, zod); sanitizes HTML/markdown
  from actions/deadlines/summary; bounded multi-attempt routing with a circuit
  breaker (`src/lib/ai.ts`).
- [x] **Accuracy harness**: `npm run eval` reports precision/recall/exact-match
  over a labeled dataset; `npm test` covers success, bad JSON, 429, 5xx,
  timeout, empty, and quota paths with a mocked provider.
- [x] **Mailgun-only inbox**: the Pro inbox uses the forward-to-TaskMind
  receive route — no third-party OAuth scopes, no stored provider tokens.
  Replies are sent through the app's own Mailgun domain.
- [x] **Share links encrypted**: tokens are AES-256-GCM encrypted server-side
  (`SHARE_SECRET`, falls back to `AUTH_SECRET`); raw input never appears in the
  URL, and `sensitive` payloads are stripped before the client sees them. Link
  creation is rate-limited (60/min/IP).
- [x] **Inbound webhook verification**: the forward-to-TaskMind route
  (`POST /api/mailgun/inbound`) verifies the Mailgun HMAC signature within a
  15-minute window (replay protection), rate-limits per slug, and drops
  auto-replies/transactional senders before analysis.

## Known risks & remediation plan

1. **Share links are encrypted and expire after 30 days** — `SHARE_TTL_MS` in
   `src/lib/share-crypto.ts`; tokens older than 30 days (or created more than
   60s in the future) are rejected on load and in the create route. The legacy
   unencrypted base64 decode path was removed in the 2026-08 security pass.
2. **CSP relies on `'unsafe-inline'` / `'unsafe-eval'`** — per-request nonces
   (SEC-13) would drop `'unsafe-inline'` for scripts, but Next (self-hosted via
   `next start`) has no built-in nonce support and stamping them requires a
   custom Node server. Assessed and deferred; the production-only CSP in
   `next.config.js` remains strict on everything else (`default-src 'self'`,
   `object-src 'none'`, `frame-ancestors 'none'`, HSTS, etc.) and was verified
   against the live Next 16 build.
3. **`@xenova/transformers` chain** — the `onnxruntime-web` → `protobufjs`
   browser dependency is never loaded (summarization runs server-side via
   `onnxruntime-node`). `protobufjs` is overridden to `^7.6.3` and `sharp` to
   `^0.35.0` via `package.json` `overrides`, clearing the advisory chain
   (`npm run security:audit` reports 0). Model files are fetched from a pinned
   HuggingFace URL, not user input.
4. **`underscore` (via `mammoth`)** — docx extraction only; parser DoS on
   untrusted `.docx`. Overridden to `^1.13.6` (installs latest 1.13.x).

## Dependency status

- `next@16.3.1` + `react/react-dom@19.2.x` (see `README.md` migration notes).
- `npm audit --omit=dev` is clean (0 vulnerabilities).
- Builds run with `--webpack` (Next 16 defaults to Turbopack, which does not
  honor the `webpack()` config that externalizes runtime-loaded native modules;
  see `README.md`).

## Key rotation & least privilege

- Keys are injected at runtime via env; never hardcode or commit them.
- Use one TokenRouter key per environment if possible; rotate by replacing the
  env value and restarting (circuit-breaker state resets on restart).
- `ADMIN_TOKEN` guards debug routes in production; rotate it like a password.
- `AUTH_SECRET` signs sessions — set a stable, long random value in production;
  rotation invalidates all sessions.

## Data access / audit

- Structured request logs contain request id, endpoint, byte counts, latency —
  never raw text. See `src/lib/log.ts`.
- Sentry error tracking is integrated (client, server, edge). PII is scrubbed
  before events are sent — analyzed text, cookies, and raw provider messages
  are stripped. See `sentry.client.config.ts`, `sentry.server.config.ts`,
  `src/lib/sentry.ts`. DSN configured via `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`.
- Error boundary (`src/components/ui/ErrorBoundary.tsx`) wraps the root layout
  to capture and report client-side render errors.
