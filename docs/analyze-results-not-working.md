# Analyze Results - Troubleshooting Guide

## Overview

The "Analyze Results" feature uses AI (via OpenRouter) to analyze text and extract actionable items, deadlines, urgency levels, and confusing parts. This document explains why the feature might not work and how to resolve issues.

---

## Common Issues and Solutions

### 1. API Key Not Configured

**Symptom:** Error message: "No OpenRouter API keys configured"

**Cause:** The application requires OpenRouter API keys to be set in the environment.

**Solution:**
```bash
# Add to your .env.local file
OPENROUTER_API_KEY1=sk-or-v1-xxxxx
OPENROUTER_API_KEY2=sk-or-v1-yyyyy  # Optional, for failover
OPENROUTER_API_KEY3=sk-or-v1-zzzzz  # Optional, for failover
```

**Location in code:** `src/lib/openrouter.ts` (the `API_KEYS` list in the `OpenRouterAPI` class).

---

### 2. API Key Exhausted (Credit Limit Reached)

**Symptom:** Error message: "All OpenRouter API keys are exhausted or rate limited"

**Cause:** The OpenRouter API keys have run out of credits or exceeded their quota.

**Solution:**
1. Log in to your [OpenRouter Dashboard](https://openrouter.ai/)
2. Add credits to your account
3. Or wait for the rate limit to reset (typically 1 minute)

**Location in code:** `src/lib/openrouter.ts` — key status tracking + `throwIfAllKeysExhausted()`.

The application automatically detects when keys are exhausted via:
- Error messages containing "credit", "quota", "exhausted"
- HTTP status codes 402 (Payment Required) and 429 (Too Many Requests)

---

### 3. Rate Limiting

**Symptom:** Error message: "rate limit exceeded"

**Cause:** Too many requests in a short period.

**Solution:**
- Wait 30-60 seconds before retrying
- The app has automatic failover to secondary API keys (exponential backoff + jitter)

**Location in code:** `src/lib/openrouter.ts` — `withRetry()`, `isRetryableError()`.

---

### 4. Text Too Short

**Symptom:** Error message: "Text too short - please provide more content"

**Cause:** Input text is less than 10 characters after cleaning.

**Solution:**
- Provide at least 10 characters of meaningful text
- The cleaning process removes special characters and extra whitespace

**Location in code:** `src/app/actions/analyzeText.ts`.

---

### 5. Network Connection Issues

**Symptom:** Requests timeout or fail to connect

**Cause:**
- No internet connection
- Firewall blocking OpenRouter requests
- DNS resolution issues

**Solution:**
- Check your internet connection
- Ensure `https://openrouter.ai` is accessible
- The app automatically falls back to rule-based analysis

**Location in code:** `src/lib/openrouter.ts` — `fetchWithTimeout()` (60s timeout, 2 retries).

---

### 6. Invalid JSON Response

**Symptom:** Error message: "Invalid JSON response from OpenRouter"

**Cause:** The AI returned malformed JSON that couldn't be parsed.

**Solution:**
- This is usually transient; retry the request
- The app has error handling that should retry automatically

**Location in code:** `src/lib/openrouter.ts` (`analyzeText`) and `src/lib/streamParse.ts` (streaming parser).

---

### 7. Empty Response from API

**Symptom:** Error message: "Empty response from OpenRouter"

**Cause:** The API returned an empty or malformed response.

**Solution:**
- Retry the request
- Check if OpenRouter is experiencing outages

**Location in code:** `src/lib/openrouter.ts` (`makeRequest` / `streamFromKey`).

---

## Fallback Mechanism

The application has a **rule-based fallback system** that activates when OpenRouter fails (`src/app/actions/analyzeText.ts`):

1. **Cleans and normalizes input**
2. **Extracts actions** using keyword matching for verbs like: submit, attend, pay, respond, bring, fill out, register, watch, send, reply
3. **Detects deadlines** using `src/lib/deadline.ts` (chrono-node + regex fallbacks for today/tomorrow/bukas/weekdays/months)
4. **Classifies urgency** using `src/lib/urgency.ts` (deadline-horizon aware)

**Note:** The rule-based fallback is less accurate than AI but ensures the app remains functional.

---

## Debug Endpoints

Debug endpoints let you verify the analysis pipeline directly. They run on the dev server at `http://localhost:3001`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/debug/openrouter` | POST | Runs `openRouterAPI.analyzeText` directly (raw AI path) |
| `/api/debug/server-action` | POST | Runs the full `analyzeText` server action (AI + rule fallback) |
| `/api/debug/health` | GET | Uptime + OpenRouter key health |

Both POST endpoints accept an optional JSON body to override the sample input:
```bash
curl -X POST http://localhost:3001/api/debug/server-action \
  -H "Content-Type: application/json" \
  -d '{"input":"Submit the report by end of day Friday"}'
```

**Production gating:** debug routes return `404` when `NODE_ENV === "production"` unless an `ADMIN_TOKEN` env var is set. When set, requests must include `Authorization: Bearer <ADMIN_TOKEN>`. The `/api/debug/health` endpoint is public.

Responses include `latencyMs` and `keyStatuses` (per-key error/exhausted/rate-limited/working state).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY1` | Yes | Primary OpenRouter API key |
| `OPENROUTER_API_KEY2` | No | Failover key |
| `OPENROUTER_API_KEY3` | No | Failover key |
| `OPENROUTER_MODEL` | No | Model id (default `anthropic/claude-sonnet-5`) |
| `OPENROUTER_TEMPERATURE` | No | Sampling temperature (default `0.1`) |
| `OPENROUTER_MAX_TOKENS` | No | Max output tokens (default `900`) |
| `NEXT_PUBLIC_APP_URL` | No | App URL for API requests / canonical URLs |
| `AUTH_SECRET` | Yes (prod) | HMAC secret for session tokens |
| `ADMIN_TOKEN` | No | Bearer token guarding debug endpoints in production |

---

## Debugging

### Test API Keys Manually

```bash
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-sonnet-5", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Check API Key Status

The `OpenRouterAPI` class tracks key statuses. Access via:
```typescript
import { openRouterAPI } from '@/lib/openrouter';
const statuses = openRouterAPI.getKeyStatuses();
```

Or via the health endpoint: `curl http://localhost:3001/api/debug/health`.

---

## Architecture

```
User Input
    ↓
src/app/actions/analyzeText.ts
    ↓
┌─────────────────────────────┐
│ Try OpenRouter (AI)        │
│ src/lib/openrouter.ts      │
└─────────────────────────────┘
    ↓ Success              ↓ Failure
┌───────────┐      ┌───────────────────┐
│ Return    │      │ Fallback to Rules  │
│ Result    │      │ analyzeWithRules() │
└───────────┘      └───────────────────┘
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/openrouter.ts` | OpenRouter API integration |
| `src/lib/stream.ts` | Streaming analysis orchestration (cancel/timeout) |
| `src/lib/streamParse.ts` | Streaming SSE parser |
| `src/app/actions/analyzeText.ts` | Main analysis logic (AI + fallback) |
| `src/lib/analyzeRules.ts` | Rule-based analysis |
| `src/lib/errors.ts` | Error handling utilities |
| `src/components/input/InputArea.tsx` | Input UI component |

---

## Support

If issues persist after trying the solutions above:
1. Check [OpenRouter Status](https://status.openrouter.ai/)
2. Verify your API key has active credits
3. Check the browser console for JavaScript errors
4. Review server logs for detailed error messages
5. Run the debug endpoints to isolate which path is failing
