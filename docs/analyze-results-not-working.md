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

**Location in code:** `src/lib/openrouter.ts:28-32`

---

### 2. API Key Exhausted (Credit Limit Reached)

**Symptom:** Error message: "All OpenRouter API keys are exhausted or rate limited"

**Cause:** The OpenRouter API keys have run out of credits or exceeded their quota.

**Solution:**
1. Log in to your [OpenRouter Dashboard](https://openrouter.ai/)
2. Add credits to your account
3. Or wait for the rate limit to reset (typically 1 minute)

**Location in code:** `src/lib/openrouter.ts:106-112`

The application automatically detects when keys are exhausted via:
- Error messages containing "credit", "quota", "exhausted"
- HTTP status codes 402 (Payment Required) and 429 (Too Many Requests)

---

### 3. Rate Limiting

**Symptom:** Error message: "rate limit exceeded"

**Cause:** Too many requests in a short period.

**Solution:**
- Wait 30-60 seconds before retrying
- The app has automatic failover to secondary API keys

**Location in code:** `src/lib/openrouter.ts:43-60`

---

### 4. Text Too Short

**Symptom:** Error message: "Text too short - please provide more content"

**Cause:** Input text is less than 10 characters after cleaning.

**Solution:**
- Provide at least 10 characters of meaningful text
- The cleaning process removes special characters and extra whitespace

**Location in code:** `src/app/actions/analyzeText.ts:297-299`

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

**Location in code:** `src/app/actions/analyzeText.ts:304-313`

---

### 6. Invalid JSON Response

**Symptom:** Error message: "Invalid JSON response from OpenRouter"

**Cause:** The AI returned malformed JSON that couldn't be parsed.

**Solution:**
- This is usually transient; retry the request
- The app has error handling that should retry automatically

**Location in code:** `src/lib/openrouter.ts:166-170`

---

### 7. Empty Response from API

**Symptom:** Error message: "Empty response from OpenRouter"

**Cause:** The API returned an empty or malformed response.

**Solution:**
- Retry the request
- Check if OpenRouter is experiencing outages

**Location in code:** `src/lib/openrouter.ts:96-98`

---

## Fallback Mechanism

The application has a **rule-based fallback system** that activates when OpenRouter fails. This fallback:

1. **Cleans and normalizes input** (`src/app/actions/analyzeText.ts:40-54`)
2. **Extracts actions** using keyword matching for verbs like: submit, attend, pay, respond, bring, fill out, register, watch, send, reply
3. **Detects deadlines** using regex patterns for: today, tomorrow, until lifted, effective dates
4. **Classifies urgency** based on keywords: urgent, asap, immediately, tropical cyclone, heavy rainfall

**Note:** The rule-based fallback is less accurate than AI but ensures the app remains functional.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY1` | Yes | Primary OpenRouter API key |
| `OPENROUTER_API_KEY2` | No | Failover key |
| `OPENROUTER_API_KEY3` | No | Failover key |
| `NEXT_PUBLIC_APP_URL` | No | App URL for API requests |

---

## Debugging

### Enable Verbose Logging

The application logs errors to the console. Check your terminal/console for detailed error messages.

### Test API Keys Manually

```bash
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-3.5-sonnet", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Check API Key Status

The `OpenRouterAPI` class tracks key statuses. Access via:
```typescript
import { openRouterAPI } from '@/lib/openrouter';
const statuses = openRouterAPI.getKeyStatuses();
```

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
| `src/app/actions/analyzeText.ts` | Main analysis logic |
| `src/lib/errors.ts` | Error handling utilities |
| `src/components/main-input-area/page.tsx` | UI component |

---

## Support

If issues persist after trying the solutions above:
1. Check [OpenRouter Status](https://status.openrouter.ai/)
2. Verify your API key has active credits
3. Check the browser console for JavaScript errors
4. Review server logs for detailed error messages
