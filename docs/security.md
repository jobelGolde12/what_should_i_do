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
- **Auth** (optional, Feature 19): scrypt password hashing with timing-safe
  compare, HMAC-signed HttpOnly/SameSite session cookies (`taskmind_session`,
  30-day expiry), file-backed user store in `.data/` (gitignored).
- **Share links**: base64-encoded payload embedded in the URL. Not encrypted,
  no expiry. `includeInput`/`sensitive` options control whether raw input is
  embedded and shown.

## Endpoint inventory & controls

| Endpoint | Auth | Rate limit | Size limit | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/analyze/stream` | none | 15/min/IP | 20,000 chars (413) | SSE; falls back to rule-based |
| `POST /api/summarize` | none | 10/min/IP | 20,000 chars (413) | offline model + extractive fallback |
| `POST /api/translate` | none | 30/min/IP | chunked 480/sentence | cached |
| `POST /api/auth/login` | — | 10/min/IP (429) | — | |
| `POST /api/auth/register` | — | 10/min/IP (429) | — | 409 on dup |
| `GET/PUT/DELETE /api/users/me` | session | — | PUT ≤ 2 MB (413) | erasure on DELETE |
| `/api/debug/*` | `ADMIN_TOKEN` Bearer (prod) | — | 20k input | 404 unless configured in prod |

Rate limiting is per-process/in-memory (`src/lib/rateLimit.ts`) — appropriate
for abuse protection at this scale; deploy behind a reverse proxy/edge for
distributed limiting.

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

## Data access / audit

- Structured request logs contain request id, endpoint, byte counts, latency —
  never raw text. See `src/lib/log.ts`.
- Sentry/error tracking is not yet integrated; add it without logging text
  (Feature 21 deferral).
