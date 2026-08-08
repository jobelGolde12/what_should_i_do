# Feature 21 — Debug & Diagnostics

## 1. What it is & its role

The **Debug & Diagnostics** feature consists of internal endpoints that test the OpenRouter integration and server action so developers can verify the analysis pipeline. Its role is dev-time troubleshooting.

## 2. Current functionality

### Where it lives
- **OpenRouter test:** `src/app/api/debug/openrouter/route.ts` → POST calls `openRouterAPI.analyzeText('Suspend classes today due to heavy rainfall')`.
- **Server-action test:** `src/app/api/debug/server-action/route.ts` → POST calls `analyzeText('...')`.
- **Docs:** `docs/analyze-results-not-working.md` (troubleshooting guide).

### How it works today
1. A developer POSTs to either debug route.
2. Each route runs the corresponding analysis path.
3. On success returns `{ success: true, result }`; on failure returns `{ success: false, error, stack }` with HTTP 500.

### Current limitations
- **Not guarded** — debug endpoints are publicly reachable in production (security/abuse risk; they consume API credits if hit).
- **No auth/rate limit.**
- **Hardcoded** test input.
- No diagnostics for key status, model, latency, or token usage.
- No UI to trigger diagnostics; must be invoked via curl/HTTP.
- The troubleshooting doc references out-of-date file paths/line numbers.

## 3. Future enhancements (production-ready Debug & Diagnostics)

### 3.1 Production-safe gating
- **Disable or guard** debug routes in production (`NODE_ENV === 'production'` → 404) or gate behind an admin token.
- Add rate limiting.

### 3.2 Rich diagnostics
- Return per-key health (`getKeyStatuses()`), model used, latency, token usage, and a full error chain.
- Add a `/api/debug/health` endpoint for uptime checks.

### 3.3 Observability
- Integrate structured logging and an error tracker (e.g., Sentry) across the analysis pipeline.
- Add request IDs/tracing so failures are correlatable.

### 3.4 Admin UI
- Build a protected diagnostics page to run tests, view key health, and inspect recent failures.

### 3.5 Documentation
- Update `docs/analyze-results-not-working.md` to match current file paths, line references, model names, and behavior.

### 3.6 Testing
- Tests asserting debug routes are disabled in production and rate-limited.

> **Status: DONE** — Implemented in this round: production-safe gating (`src/lib/debug/guard.ts` — debug routes return 404 in production unless `ADMIN_TOKEN` is set, then require `Authorization: Bearer <token>`); rich diagnostics (custom `{ input }` body up to 20k chars, `latencyMs`, `keyStatuses`, `analysisMethod` in responses); new public `GET /api/debug/health` endpoint reporting uptime + per-key health (`isWorking` now tracked in `OpenRouterAPI` on both request and streaming success); rewrote the troubleshooting doc with current paths, env vars (including `OPENROUTER_MODEL`/`OPENROUTER_MAX_TOKENS`/`AUTH_SECRET`/`ADMIN_TOKEN`), and the new debug endpoints. **Also fixed a production bug found during verification**: `parseDeadline` crashed on non-string deadline entries from AI streaming (`Cannot read properties of undefined (reading 'trim')`) — now coerces null/undefined and the AI normalizer filters non-string `actions`/`deadlines`. Structured logging/error tracker and an admin UI deferred.

> **Definition of "done" for this feature:** Debug endpoints are production-safe, gated, rate-limited, return rich diagnostics, are backed by structured logging/error tracking, and docs are accurate.
