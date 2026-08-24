# 04 — Route & Endpoint Design

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Complete Route Table

### Public Pages (No Auth Required)

| Route | Method | Component | Middleware | Auth | Description |
|-------|--------|-----------|-----------|------|-------------|
| `/` | GET | `(workspace)/page.tsx` | proxy | None | Home — input area |
| `/privacy` | GET | `privacy/page.tsx` | proxy | None | Privacy policy |
| `/terms` | GET | `terms/page.tsx` | proxy | None | Terms of service |
| `/share/[id]` | GET | `share/[id]/page.tsx` | proxy | None | Shared analysis view |

### Auth Pages

| Route | Method | Component | Middleware | Auth | Description |
|-------|--------|-----------|-----------|------|-------------|
| `/auth/login` | GET | `auth/login/page.tsx` | proxy | None | Login form |
| `/auth/register` | GET | `auth/register/page.tsx` | proxy | None | Registration form |

### Authenticated Pages (Session Required)

| Route | Method | Component | Middleware | Auth | Description |
|-------|--------|-----------|-----------|------|-------------|
| `/analysis/[id]` | GET | `(workspace)/analysis/[id]/page.tsx` | proxy | Session | Analysis result view |
| `/analysis/[id]/chat` | GET | `(workspace)/analysis/[id]/chat/page.tsx` | proxy | Session | Chat with AI about analysis |
| `/history` | GET | `(workspace)/history/page.tsx` | proxy | Session | Past analyses list |
| `/saved` | GET | `(workspace)/saved/page.tsx` | proxy | Session | Saved templates |
| `/actions` | GET | `(workspace)/actions/page.tsx` | proxy | Session | Action board (Kanban) |
| `/dashboard` | GET | `(workspace)/dashboard/page.tsx` | proxy | Session | Pro dashboard |
| `/settings` | GET | `(workspace)/settings/page.tsx` | proxy | Session | User settings & billing |

### API Routes — Analysis

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/analyze/stream` | POST | `api/analyze/stream/route.ts` | None | 15/min/IP | SSE analysis streaming |
| `/api/analysis/chat` | POST | `api/analysis/chat/route.ts` | None | 15/min/IP | SSE chat streaming |
| `/api/summarize` | POST | `api/summarize/route.ts` | None | 10/min/IP | Text summarization |
| `/api/translate` | POST | `api/translate/route.ts` | None | 30/min/IP | Text translation |

### API Routes — Auth

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/auth/register` | POST | `api/auth/register/route.ts` | None | 10/min/IP (DB) | User registration |
| `/api/auth/login` | POST | `api/auth/login/route.ts` | None | 10/min/IP (DB) | User login |
| `/api/auth/logout` | POST | `api/auth/logout/route.ts` | Session | None | Session destroy |
| `/api/auth/verify` | GET | `api/auth/verify/route.ts` | Token | None | Email verification |
| `/api/auth/resend-verification` | POST | `api/auth/resend-verification/route.ts` | None | 5/min/IP (DB) | Resend verification email |
| `/api/auth/forgot-password` | POST | `api/auth/forgot-password/route.ts` | None | 5/min/IP (DB) | Request password reset |
| `/api/auth/reset-password` | POST | `api/auth/reset-password/route.ts` | Token | 10/min/IP (DB) | Reset password |

### API Routes — User Data

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/users/me` | GET | `api/users/me/route.ts` | Session | — | Get user data |
| `/api/users/me` | PUT | `api/users/me/route.ts` | Session | — | Sync user data |
| `/api/users/me` | DELETE | `api/users/me/route.ts` | Session | — | Delete account + data |

### API Routes — Chat Topics

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/chats` | GET | `api/chats/route.ts` | Session | — | List chat topics |
| `/api/chats` | POST | `api/chats/route.ts` | Session | — | Create chat topic |
| `/api/chats/[id]` | GET | `api/chats/[id]/route.ts` | Session | — | Get chat topic |
| `/api/chats/[id]` | PUT | `api/chats/[id]/route.ts` | Session | — | Update chat topic |
| `/api/chats/[id]` | DELETE | `api/chats/[id]/route.ts` | Session | — | Delete chat topic |

### API Routes — Sharing

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/share` | POST | `api/share/route.ts` | None | 60/min/IP (DB) | Create share link |
| `/api/share/[id]` | GET | `api/share/[id]/route.ts` | None | — | Get shared analysis |

### API Routes — Billing (Pro)

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/billing/checkout` | POST | `api/billing/checkout/route.ts` | Session + Pro | — | Create Stripe checkout |
| `/api/billing/portal` | POST | `api/billing/portal/route.ts` | Session + Pro | — | Stripe customer portal |
| `/api/billing/webhook` | POST | `api/billing/webhook/route.ts` | Stripe sig | — | Stripe webhook handler |

### API Routes — Inbox (Pro)

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/inbox` | GET | `api/inbox/route.ts` | Session + Pro | — | List inbox messages |
| `/api/inbox/forward` | GET | `api/inbox/forward/route.ts` | Session + Pro | — | Get forward address |
| `/api/inbox/context` | GET | `api/inbox/context/route.ts` | Session + Pro | — | Get reply context |
| `/api/inbox/send` | POST | `api/inbox/send/route.ts` | Session + Pro | — | Send reply via Mailgun |

### API Routes — Reminders (Pro)

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/reminders` | GET | `api/reminders/route.ts` | Session + Pro | — | List reminders |
| `/api/reminders` | POST | `api/reminders/route.ts` | Session + Pro | — | Create reminder |
| `/api/reminders/[id]` | DELETE | `api/reminders/[id]/route.ts` | Session + Pro | — | Delete reminder |

### API Routes — Settings

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/settings/reminders` | GET | `api/settings/reminders/route.ts` | Session + Pro | — | Get reminder prefs |
| `/api/settings/reminders` | PUT | `api/settings/reminders/route.ts` | Session + Pro | — | Update reminder prefs |

### API Routes — File Operations

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/convert` | POST | `api/convert/route.ts` | None | 5/min/IP | File to text conversion |
| `/api/extract` | POST | `api/extract/route.ts` | None | 5/min/IP | Text extraction from files |

### API Routes — Cron (Server-Only)

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/cron/reminders` | POST | `api/cron/reminders/route.ts` | Bearer (CRON_SECRET) | — | Due-reminder email sweep |
| `/api/cron/digest` | POST | `api/cron/digest/route.ts` | Bearer (CRON_SECRET) | — | Weekly digest emails |

### API Routes — Webhooks

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/mailgun/inbound` | POST | `api/mailgun/inbound/route.ts` | HMAC sig | 60/hr/slug | Inbound email processing |

### API Routes — Health & Debug

| Route | Method | Handler | Auth | Rate Limit | Description |
|-------|--------|---------|------|-----------|-------------|
| `/api/health` | GET | `api/health/route.ts` | None | — | Health check |
| `/api/debug/env` | GET | `api/debug/env/route.ts` | ADMIN_TOKEN (prod) | — | Env diagnostics |
| `/api/debug/ai` | GET | `api/debug/ai/route.ts` | ADMIN_TOKEN (prod) | — | AI diagnostics |

---

## Middleware Pipeline (proxy.ts)

```
Request → proxy.ts
  ├── GET/HEAD → pass through (no CSRF check)
  ├── POST/PUT/PATCH/DELETE:
  │     ├── No Origin header → pass through (webhook/cron/curl)
  │     ├── Origin host matches Host header → pass through (same-origin)
  │     ├── Origin in CSRF_ALLOWED_ORIGINS → pass through (allow-listed)
  │     └── Otherwise → 403 "Cross-origin request blocked."
  └── → Next.js route handler
```

---

## Request/Response Lifecycle

### Analysis SSE Stream (POST /api/analyze/stream)

```
1. Client sends POST with { text, deep? }
2. proxy.ts validates Origin (CSRF)
3. getClientIp extracts client IP
4. rateLimit checks 15/min/IP
5. Body parsed; text validated (10–20,000 chars)
6. tryIncrement for usage metering (signed-in users)
7. aiClient.streamText() called:
   a. buildAnalysisMessages() builds prompt
   b. Provider cascade: TokenRouter → OpenRouter → Zen → rules
   c. Each provider: SSE stream → onDelta callbacks
8. SSE events sent to client:
   - { type: "text", text: accumulated } per delta
   - { type: "done", text, result, method, provider } on completion
   - { type: "error", message } on failure
   - { type: "ping" } every 10s (heartbeat)
9. logRequest records metadata (no PII)
10. Stream closed
```

### Chat SSE Stream (POST /api/analysis/chat)

```
1. Client sends POST with { message, originalMessage?, analysis?, history? }
2. proxy.ts validates Origin (CSRF)
3. getClientIp extracts client IP
4. rateLimit checks 15/min/IP
5. Body parsed; message validated (non-empty, ≤4,000 chars)
6. History sanitized (max 20 turns, ≤4,000 chars each)
7. tryIncrement for chat_messages metric (signed-in users)
8. buildChatMessages() constructs prompt with grounding context
9. streamChatCompletion() called (OpenRouter-only):
   a. fetch with idle watchdog timeout
   b. SSE stream → consumeSseStream
   c. onDelta callbacks send to client
10. SSE events sent to client:
    - { type: "text", text: accumulated } per delta
    - { type: "done", text, method } on completion
    - { type: "error", message } on failure
    - { type: "ping" } every 10s (heartbeat)
11. logRequest records metadata (no PII)
12. Stream closed
```

### Auth Flow (Register → Verify → Login)

```
1. Register: POST /api/auth/register { email, password }
   → rateLimitDb check (10/min/IP)
   → scrypt hash password
   → INSERT users
   → Mailgun verification email (stateless HMAC token)
   → Return 201

2. Verify: GET /api/auth/verify?token=...
   → Verify HMAC signature
   → Check token expiry (24h)
   → Check auth_version match
   → Bump auth_version (revokes all prior sessions)
   → Set verified = 1
   → Set session cookie
   → Redirect to /

3. Login: POST /api/auth/login { email, password }
   → rateLimitDb check (10/min/IP)
   → Find user by email
   → Verify password (scrypt timing-safe compare)
   → Check verified = 1
   → Set session cookie (HMAC-signed, 30-day expiry)
   → Return 200
```

### Sync Flow (PUT /api/users/me)

```
1. Client sends PUT with { analyses, boardItems, templates, settings, lastSync }
2. Session cookie validated → getCurrentUserId
3. Each record validated against allow-list schema
4. Invalid record → reject entire batch (400)
5. LWW merge: server updated_at vs client lastSync
   → Newer wins; conflicts counted
6. Batch INSERT/UPDATE for each entity type
7. Return { synced, conflicts }
```

---
