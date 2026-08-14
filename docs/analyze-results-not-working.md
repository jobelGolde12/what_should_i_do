# Analyze Results - Troubleshooting Guide

## Overview

The "Analyze Results" feature uses AI (via TokenRouter) to analyze text and
extract actionable items, deadlines, urgency levels, and confusing parts. The
AI client lives in `src/lib/ai.ts`; the prompt in `src/lib/prompts.ts`; strict
schema validation + repair in `src/lib/validateAnalysis.ts`. This document
explains why the feature might not work and how to resolve issues.

---

## Architecture

```
User Input
    ↓
src/app/actions/analyzeText.ts            (server action — blocking)
src/app/api/analyze/stream/route.ts       (SSE streaming — primary UI path)
    ↓
src/lib/ai.ts  (AIClient — TokenRouter primary, OpenRouter secondary)
    │  retries / backoff / circuit breakers / multi-model routing
    │  → OpenRouter fallback when TokenRouter fails or is tripped
    ↓
src/lib/validateAnalysis.ts  (zod strict parse → repair → quality gate)
    ↓ Success              ↓ Failure (after N attempts)
┌───────────────┐      ┌──────────────────────┐
│ Return result │      │ Fallback to rules    │
│ (analysisMethod │      │ analyzeWithRules()   │
│  = "ai")       │      │ (analysisMethod =    │
└───────────────┘      │  "fallback")          │
                       └──────────────────────┘
```

---

## Common Issues and Solutions

### 1. AI Provider Key Not Configured

**Symptom:** "No AI provider configured (set TOKENROUTER_API_KEY or OPENROUTER_API_KEY)"

**Cause:** Neither `TOKENROUTER_API_KEY` nor `OPENROUTER_API_KEY` is set.

**Solution:**
```bash
# Add to your .env (server-side only — never prefix with NEXT_PUBLIC_)
TOKENROUTER_API_KEY=tr-xxxxxxxx
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=            # optional: model id or routing tag

# Optional secondary fallback used when TokenRouter fails/times out:
OPENROUTER_API_KEY=sk-or-xxxxxxxx
# OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # defaults if unset
```

**Location in code:** `src/lib/ai.ts` (the `AIClient` constructor).

---

### 2. Provider Quota Exhausted (Credit Limit Reached)

**Symptom:** "AI provider quota exhausted. Add credits or switch provider."

**Cause:** The TokenRouter account has run out of credits (HTTP 402, or a
`credit`/`quota`/`insufficient` error from the provider).

**Solution:**
1. Add credits in the TokenRouter dashboard.
2. Or set a different `TOKENROUTER_API_KEY` / `TOKENROUTER_MODEL`.

The app detects quota errors and surfaces them (`ALL_KEYS_EXHAUSTED`) instead of
retrying or silently degrading — on both the server action and the streaming
UI path (quota errors never fall back to the rule-based analyzer).

---

### 3. Rate Limiting / Transient Provider Errors

**Symptom:** "AI analysis failed after 3 attempts: ..." (rate limit / 5xx /
timeout / network)

**Cause:** The provider returned 429 or 5xx, or the request timed out.

**Solution:**
- Wait a bit and retry.
- The client already retries with exponential backoff + jitter and can switch
  to `TOKENROUTER_MODEL_FALLBACKS` (comma-separated) across attempts.
- When TokenRouter is down (or its circuit breaker is open), requests
  automatically fall through to the secondary OpenRouter provider before the
  rule-based analyzer is considered.
- `TOKENROUTER_TIMEOUT_MS` (default 60000) and `TOKENROUTER_MAX_ATTEMPTS`
  (default 3) tune the primary provider; `OPENROUTER_TIMEOUT_MS` and
  `OPENROUTER_MAX_ATTEMPTS` tune the secondary.

**Location in code:** `src/lib/ai.ts` — `backoff()`, attempt loops, and the
`RouteCircuitBreaker`.

---

### 4. Text Too Short

**Symptom:** "Text too short - please provide more content"

**Cause:** Input text is less than 10 characters after cleaning.

**Solution:** Provide at least 10 characters of meaningful text.

**Location in code:** `src/lib/ai.ts` (`guardAndBuild`) and
`src/app/actions/analyzeText.ts`.

---

### 5. Invalid / Malformed JSON from the Model

**Symptom:** Analysis falls back to rules; debug route shows
`INVALID_JSON` / `INVALID_RESPONSE`.

**Cause:** The model returned non-JSON, an unusable shape, or a response with
no usable content.

**Solution:**
- The pipeline already: strips markdown fences, salvages truncated JSON
  (complete fields), clamps urgency, coerces arrays, and retries on a fallback
  route before falling back to rules. This is usually transient — retry.
- Check the debug route for which attempt/model produced what.

**Location in code:** `src/lib/validateAnalysis.ts` and `src/lib/streamParse.ts`.

---

### 6. Empty Response from the Provider

**Symptom:** "Empty response from AI provider" / "Empty streaming response".

**Cause:** The provider returned no content, or the stream produced no tokens.

**Solution:** Retry; if persistent, switch `TOKENROUTER_MODEL` or the provider.

**Location in code:** `src/lib/ai.ts` (`requestChat` / `streamFromModel`).

---

## Fallback Mechanism

When the AI client fails after all attempts, the app runs the **rule-based
fallback** (`src/lib/analyzeRules.ts`) and marks the result with
`analysisMethod: "fallback"` so the UI can indicate it. The fallback:

1. Cleans and normalizes input (`cleanText` + `enhanceInput`).
2. Extracts actions using the lexicon in `src/lib/actionUtils.ts`.
3. Detects deadlines via `src/lib/deadline.ts` (chrono-node + regex).
4. Classifies urgency via `src/lib/urgency.ts`.

The rule-based fallback is far less accurate than the AI path. Run
`npm run eval` to see the measured gap.

---

## Debug Endpoints

Debug endpoints verify the analysis pipeline directly. They run on the dev
server at `http://localhost:3001`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/debug/ai` | POST | Runs `aiClient.analyzeStructured` directly (raw AI path) with usage + diagnostics |
| `/api/debug/server-action` | POST | Runs the full `analyzeText` server action (AI + rule fallback) |
| `/api/debug/env` | GET | Shows which `TOKENROUTER_*` / `OPENROUTER_*` vars exist |
| `/api/debug/health` | GET | Uptime + AI client config (public) |

The POST endpoints accept an optional JSON body to override the sample input:
```bash
curl -X POST http://localhost:3001/api/debug/ai \
  -H "Content-Type: application/json" \
  -d '{"input":"Submit the report by end of day Friday"}'
```

**Production gating:** debug routes return `404` when `NODE_ENV ===
"production"` unless an `ADMIN_TOKEN` env var is set. When set, requests must
include `Authorization: Bearer <ADMIN_TOKEN>`. `/api/debug/health` is public.

Responses include `latencyMs` and `usage` (model, attempt, repaired, token
usage). The `diagnostics` field reports the configured model, fallbacks,
auto-route state, prompt version, and circuit-breaker state.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKENROUTER_API_KEY` | **Yes** | TokenRouter API key (server-only) |
| `TOKENROUTER_BASE_URL` | No | API base URL (default `https://api.tokenrouter.com/v1`) |
| `TOKENROUTER_MODEL` | No | Model id or routing tag (empty → auto-route) |
| `TOKENROUTER_MODEL_FALLBACKS` | No | Comma-separated fallback models tried on retry |
| `TOKENROUTER_TEMPERATURE` | No | Sampling temperature (default `0.1`) |
| `TOKENROUTER_MAX_TOKENS` | No | Max output tokens (default `900`) |
| `TOKENROUTER_TIMEOUT_MS` | No | Request timeout (default `60000`) |
| `TOKENROUTER_MAX_ATTEMPTS` | No | Max routing attempts (default `3`) |
| `OPENROUTER_API_KEY` | No | Secondary fallback provider key (used when TokenRouter fails) |
| `OPENROUTER_BASE_URL` | No | OpenRouter base URL (default `https://openrouter.ai/api/v1`) |
| `OPENROUTER_MODEL` | No | OpenRouter model id (default `anthropic/claude-3.5-sonnet`) |
| `OPENROUTER_MODEL_FALLBACKS` | No | Comma-separated OpenRouter fallback models |
| `OPENROUTER_MAX_ATTEMPTS` | No | Max attempts on OpenRouter (default `2`) |
| `NEXT_PUBLIC_APP_URL` | No | App URL (also sent as `HTTP-Referer` to OpenRouter) |
| `AUTH_SECRET` | Yes (prod) | HMAC secret for session tokens |
| `ADMIN_TOKEN` | No | Bearer token guarding debug endpoints in production |

`OPENROUTER_API_KEY` is now the **secondary fallback provider**: it is used
automatically when TokenRouter fails, times out, or its circuit breaker is
open. Legacy `OPENROUTER_API_KEY1/2/3` variables are no longer read by the app.

---

## Debugging

### Test the AI Provider Manually

```bash
curl -X POST https://api.tokenrouter.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "", "messages": [{"role": "user", "content": "Say hi"}], "max_tokens": 20}'
```

### Check AI Client Health

`curl http://localhost:3001/api/debug/health` reports whether the provider is
configured, the active model, fallbacks, prompt version, and circuit-breaker
state.

### Run the accuracy harness

```bash
npm run eval            # rule-based baseline (offline)
npm run eval -- live    # live AI provider (needs key + credits)
npm test                # unit/integration tests (mocked provider)
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/ai.ts` | AI client (TokenRouter → OpenRouter → rules cascade, retries, breakers) |
| `src/lib/prompts.ts` | Versioned analysis prompt + few-shot examples |
| `src/lib/validateAnalysis.ts` | zod schema validation + repair |
| `src/lib/streamParse.ts` | Streaming SSE parser + progressive fields |
| `src/lib/stream.ts` | Client-side streaming orchestration (cancel/timeout) |
| `src/app/actions/analyzeText.ts` | Main analysis logic (AI + fallback) |
| `src/lib/analyzeRules.ts` | Rule-based fallback |
| `src/lib/errors.ts` | Error handling utilities |
| `tests/ai.test.ts` | Mocked provider tests (success, bad JSON, 429, 5xx, timeout) |
| `evaluation/cases/*.json` | Labeled accuracy dataset for `npm run eval` |

---

## Support

If issues persist after trying the solutions above:
1. Check TokenRouter status/dashboard for account health.
2. Verify `TOKENROUTER_API_KEY` has active credits.
3. Check the browser console for JavaScript errors.
4. Review server logs for structured diagnostics (input text is never logged).
5. Run the debug endpoints to isolate which path is failing.
