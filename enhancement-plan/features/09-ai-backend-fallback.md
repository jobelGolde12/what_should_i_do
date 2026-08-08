# Feature 09 — AI Backend & Fallback (OpenRouter integration)

> **Status: DONE** — `OpenRouterAPI` now has a 60s request timeout (`fetchWithTimeout` + `AbortController`), retry with exponential backoff + jitter for transient errors (timeout/network/503/504) via `withRetry()`, env-driven `OPENROUTER_MODEL`/`OPENROUTER_TEMPERATURE`/`OPENROUTER_MAX_TOKENS`, and a 20k-char input cap before hitting the LLM. Applied to both the non-streaming and streaming paths.

## 1. What it is & its role

The **AI Backend** is the primary analysis engine. It calls **OpenRouter** (model `anthropic/claude-sonnet-5`) with a structured JSON prompt, validates the response, and provides a **rule-based fallback** when the AI path fails. Its role is to deliver high-quality structured analysis while remaining resilient to API outages, rate limits, and credit exhaustion.

## 2. Current functionality

### Where it lives
- **Client:** `src/lib/openrouter.ts` → `OpenRouterAPI` class.
- **Server action:** `src/app/actions/analyzeText.ts` → `analyzeText`, `analyzeTextFast`, `analyzeTextsBatch`.
- **Rules engine:** `src/lib/analyzeRules.ts`.
- **Errors:** `src/lib/errors.ts`.
- **Debug routes:** `src/app/api/debug/openrouter/route.ts`, `src/app/api/debug/server-action/route.ts`.

### How it works today
1. Multi-key support: up to **3** API keys (`OPENROUTER_API_KEY1/2/3`), with per-key status tracking.
2. `isRetryableError()` detects credit/quota/rate-limit/HTTP 429/402 and marks keys as exhausted/rate-limited.
3. `analyzeText()` iterates keys, skipping exhausted ones; on success validates/normalizes the JSON response.
4. Prompt engineering via `buildAnalysisMessages()` (system prompt with strict JSON schema + urgency rules).
5. On total AI failure, `analyzeText` falls back to `analyzeWithRules()`.
6. Streaming variant via `streamRaw()` (see Feature 10).

### Current limitations
- **No request timeout** — a hung request can stall analysis indefinitely.
- **No automatic retry/backoff** for transient (non-credit) errors — it just moves to the next key.
- **Key rotation is per-server-instance** (in-memory `keyStatuses`), not shared across instances/Vercel lambdas.
- No **model selection** or configurable temperature/max_tokens.
- No **circuit breaker** or health probing.
- Prompt is hardcoded (no prompt versioning or A/B).
- No cost tracking or usage analytics.
- The documented model ("claude-3.5-sonnet") differs from the code model (`anthropic/claude-sonnet-5`) — inconsistency.
- No validation that the model actually follows the schema beyond shallow checks.

## 3. Future enhancements (production-ready AI Backend)

### 3.1 Reliability layer
- Add **request timeouts** (AbortController) and **retry with exponential backoff + jitter** for transient errors.
- Add a **circuit breaker** around OpenRouter calls.
- Persist **key health** in a shared store (Redis/DB) so rotation works across serverless instances.

### 3.2 Configuration & observability
- Environment-driven model, temperature, max_tokens, and a `MODEL` constant.
- Structured JSON schema validation of responses (e.g., `zod`).
- Logging + metrics (success rate, latency, token usage) and optional error tracking (e.g., Sentry).

### 3.3 Cost & usage controls
- Track tokens and cost per request; add per-user/global daily limits.
- Fallback chain: Claude → other models → rules.

### 3.4 Prompt engineering
- Versioned prompts; A/B test prompt variants.
- Add few-shot examples (especially Filipino/messy text).

### 3.5 Security
- Keep API keys server-only (already true).
- Validate/limit input size before sending to the LLM.

### 3.6 Testing
- Mocked OpenRouter responses (success, empty, invalid JSON, 429, 402, network error).
- Unit tests for key rotation and error classification.
- Integration test for the fallback path.

> **Definition of "done" for this feature:** AI backend has timeouts, retries/backoff, circuit breaking, shared key health, schema validation, configurable models, cost limits, observability, and comprehensive tests.
