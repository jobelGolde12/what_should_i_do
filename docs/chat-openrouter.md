# Chat Mode — OpenRouter Provider

Chat Mode is the grounded Q&A surface opened from an analysis
(`/analysis/[id]/chat`). It answers questions **only** about the analyzed
message and its analysis, streams tokens progressively, and persists the
conversation (localStorage + DB sync for signed-in users).

This document describes the provider architecture introduced when Chat Mode
moved from the shared AI cascade to an **OpenRouter-only** path.

## Architecture

```text
Chat UI (AnalysisChatView.tsx)
   ↓  SSE events: {type:"text"|"done"|"error"|"ping"}
/api/analysis/chat  (route handler)
   ↓  validation · rate limit · daily quota · error normalization
src/lib/chat/provider.ts   ← OpenRouter-only transport
   ↓  POST {baseUrl}/chat/completions  (stream: true)
OpenRouter API
   ↓  OPENROUTER_CHAT_MODEL (default: openrouter/free)
Currently available free model chosen by OpenRouter
```

Deliberate design decisions:

- **No provider fallback for chat.** The analysis pipeline keeps its
  TokenRouter → OpenRouter → Zen cascade (`src/lib/ai.ts`), but Chat Mode
  never silently falls back to another provider. If OpenRouter fails, the
  user gets a friendly retryable error — not a different vendor's answer.
- **Provider details stay out of React components.** The UI only consumes
  normalized SSE events; transport, retries, and error classification live in
  `src/lib/chat/provider.ts`.
- **Dev mock preserved.** `AI_MOCK=1` (never active in production) still
  bypasses the network so the grounded-chat flow can be developed offline.

## Configuration

All variables are server-side only. None are exposed through `NEXT_PUBLIC_*`,
returned to the client, or logged.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_CHAT_API_KEY` | falls back to `OPENROUTER_API_KEY` | Chat-specific credential; set only if you need independent keys/billing |
| `OPENROUTER_CHAT_BASE_URL` | falls back to `OPENROUTER_BASE_URL`, then `https://openrouter.ai/api/v1` | API base |
| `OPENROUTER_CHAT_MODEL` | `openrouter/free` | Logical model id |
| `OPENROUTER_CHAT_TEMPERATURE` | `0.2` | Sampling temperature |
| `OPENROUTER_CHAT_MAX_TOKENS` | `800` | Completion cap (hard ceiling 4000) |
| `OPENROUTER_CHAT_TIMEOUT_MS` | `45000` | Idle watchdog per attempt |
| `OPENROUTER_CHAT_MAX_ATTEMPTS` | `3` (max 5) | Retry budget |

Configuration is validated at request time (`resolveChatConfig()` in
`src/lib/chat/config.ts`). A missing key degrades Chat Mode gracefully with a
friendly "service not configured" message — it never crashes app startup or
affects unrelated features.

## Free-model strategy (`openrouter/free`)

The default model id is [`openrouter/free`](https://openrouter.ai/openrouter/free),
OpenRouter's **Free Models Router**. It is a stable *logical* identifier, not
a single model:

1. OpenRouter analyzes the request for required capabilities.
2. It filters the currently available free models to those that support them.
3. One eligible free model is selected per request.
4. The response/chunk `model` field reports which model actually served it.

Consequences:

- **Never hardcode or branch on a specific underlying free model** — the pool
  changes frequently (models are added and removed without notice).
- The app treats `openrouter/free` as the source of truth and captures the
  actual routed model server-side for observability.
- To pin a specific free model (e.g. for deterministic behavior), set
  `OPENROUTER_CHAT_MODEL="vendor/model:free"` after verifying it exists at
  <https://openrouter.ai/models?pricing=free>.

Context window advertised by the router: 200K tokens (text+image input, text
output). Chat Mode sends text only.

## Rate limits & usage awareness

Free-tier limits currently documented by OpenRouter:

| Account | Requests/min | Requests/day |
| --- | --- | --- |
| Never purchased ≥10 credits | 20 | **50** |
| Has purchased ≥10 credits | 20 | 1000 |

These are *provider-side* limits on top of TaskMind's own abuse protection
(per-user/IP minute rate limit + per-user daily quota in the route). The app
is designed assuming limited availability:

- 429 responses map to friendly usage-limit copy ("The free AI service has
  reached its current usage limit…").
- A provider `Retry-After` hint buys **at most one** extra in-request attempt
  (capped at 30 s); daily-limit exhaustion makes longer waiting pointless.
- Do not promise users unlimited free AI usage.

## Retry policy

Controlled retries only, and only while nothing has streamed to the client:

| Failure class (`ChatErrorKind`) | Retry? | User-facing copy |
| --- | --- | --- |
| `network`, `timeout`, `provider` (5xx) | Yes — exponential backoff + jitter, ≤ max attempts | "We couldn't answer that right now…" |
| `rate-limit` (429) | Only with explicit short `Retry-After`, once | "…reached its current usage limit…" |
| `auth` (401/403) | Never | "…could not authenticate the request…" |
| `quota` (402 / zero-credit signals) | Never | "…out of credits right now…" |
| `invalid-response` | Never | Generic retryable copy |
| `unconfigured` | Never | "Chat service is not configured…" |

Once the first delta has been delivered, any failure propagates immediately —
retrying would duplicate output. The client keeps partial answers that already
streamed and offers a Retry action.

Mid-stream failures arrive as SSE chunks carrying an `error` object (e.g.
`finish_reason: "error"` after HTTP 200) — these are parsed and classified
like HTTP errors.

## Security

- Keys live only in server env vars; requests are proxied through the route,
  so the browser never sees credentials or talks to OpenRouter directly.
- Server-side request validation: empty-message rejection, per-plan message
  length caps, history bounded to 20 turns × 4 000 chars, body-size guard
  (256 KB), JSON parse tolerance, non-object analysis payloads rejected.
- Raw provider errors, request ids, env names, and token counts are never
  sent to the client — only coarse, actionable copy keyed by error class.
- Prompt injection defenses live in the system prompt (`buildChatMessages`):
  message/analysis/history are delimited data, topic-lock rules cannot be
  relaxed by user content, and off-topic requests are refused.
- Rendered markdown is built exclusively from React elements (no
  `dangerouslySetInnerHTML`); links are restricted to http(s) URLs.

## Observability

Per-request structured logs (`logRequest`) include: request id, latency,
provider (`openrouter`), logical model, actual routed model (when OpenRouter
reports it), char counts, and a coarse failure class. Logs never contain API
keys, authorization headers, or message/analysis content.

## Changing the model later

1. Set `OPENROUTER_CHAT_MODEL` in the deployment environment (one place — no
   code changes).
2. Verify streaming still works; the transport only assumes the
   OpenAI-compatible `/chat/completions` contract.
3. If you need a paid/bigger model for chat, change the same variable — the
   retry/error handling stays identical.
