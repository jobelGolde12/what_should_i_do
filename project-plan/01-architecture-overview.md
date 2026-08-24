# 01 — Architecture Overview

> **Project:** TaskMind — Universal Instruction Translator
> **Stack:** Next.js 16.3.1 (App Router) + React 19, TypeScript, Tailwind v4, Turso/libSQL, Stripe, Mailgun
> **Date:** 2026-08-25

---

## ADR-001: Monolithic Next.js App Router with Server Actions

- [x] **Architecture Style:** Monolithic server-rendered application using Next.js App Router with React Server Components and Server Actions.

**Alternatives Considered:**
- **Microservices** — Rejected: overkill for a single-product SaaS; adds deployment complexity, network hops, and observability overhead without proportional scale benefit.
- **Serverless (Vercel)** — Rejected: the project self-hosts (`next start` with `--webpack`); runtime-loaded native modules (`onnxruntime-node`, `pdfjs-dist`) need a persistent Node process. Serverless cold-starts and ephemeral filesystems conflict with these constraints.
- **Next.js Pages Router** — Rejected: App Router provides RSC, streaming, parallel routes, and the modern `proxy.ts` (formerly Middleware) API aligned with Next 16.

**Trade-offs:**
- ✅ Single deployment unit; shared types, shared validation, shared prompts.
- ✅ Server Actions for mutations (analyzeText, sync) — no API boilerplate.
- ⚠️ Vertical scaling only (acceptable at current scale).
- ⚠️ Requires `--webpack` flag (Turbopack ignores `webpack()` externals config).

---

## High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ InputArea │ │ Results  │ │  Board   │ │  Chat    │           │
│  │ (upload,  │ │ Panel    │ │ (Kanban) │ │  View    │           │
│  │  paste)   │ │ (actions,│ │          │ │ (SSE)    │           │
│  └─────┬─────┘ │ deadlines│ └────┬─────┘ └────┬─────┘           │
│        │       │ urgency) │      │             │                 │
│        │       └────┬─────┘      │             │                 │
│        │            │            │             │                 │
│  ┌─────┴────────────┴────────────┴─────────────┴──────┐         │
│  │           localStorage (local-first)                │         │
│  │  history · templates · board · chats · theme         │         │
│  └─────────────────────┬──────────────────────────────┘         │
│                        │ sync (Pro only)                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┼─────────────────────────────────────────┐
│                    SERVER (Next.js)                               │
│  ┌─────────────────────┴──────────────────────────────┐         │
│  │                   proxy.ts (CSRF)                   │         │
│  └─────────────────────┬──────────────────────────────┘         │
│                        │                                         │
│  ┌──────────┐ ┌───────────────┐ ┌───────────┐ ┌──────────┐    │
│  │ /api/     │ │ /api/analysis │ │ /api/auth  │ │ /api/cron│    │
│  │ analyze/  │ │ /chat (SSE)   │ │ (login,    │ │ (remind, │    │
│  │ stream    │ │               │ │  register) │ │  digest) │    │
│  │ (SSE)     │ │               │ │            │ │          │    │
│  └─────┬─────┘ └───────┬───────┘ └─────┬─────┘ └────┬─────┘    │
│        │               │               │             │           │
│  ┌─────┴───────────────┴───────────────┴─────────────┴─────┐   │
│  │                    src/lib/ layer                         │   │
│  │  ai.ts (cascade)  ·  chat/provider.ts  ·  prompts.ts    │   │
│  │  validateAnalysis  ·  storage  ·  rateLimit  ·  log     │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                      │
│  ┌───────────────────────┴─────────────────────────────────┐   │
│  │              src/lib/db/ (Turso/libSQL)                  │   │
│  │  users · analyses · board_items · templates ·            │   │
│  │  subscriptions · pro_usage · chat_topics · reminders ·   │   │
│  │  inbox_messages · inbound_routes · support_tickets ·     │   │
│  │  rules · tags · rate_limits · schema_migrations          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              src/lib/pro/ (Entitlements)                  │   │
│  │  plans.ts · entitlements.ts · usage.ts · billing.ts      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ TokenRouter│ │ OpenRouter │ │ OpenCode   │
   │ (primary)  │ │ (secondary)│ │ Zen (free) │
   └────────────┘ └────────────┘ └────────────┘
          │
          ▼
   ┌────────────────────┐
   │ Turso (libSQL)     │
   │ Remote or local    │
   └────────────────────┘
```

---

## Data Flow Diagrams

### Critical Path 1: Message Analysis (SSE streaming)

```
User Input → InputArea → POST /api/analyze/stream
  → proxy.ts (CSRF check)
  → rateLimit (15/min/IP)
  → tryIncrement (usage metering)
  → aiClient.streamText() → cascade: TokenRouter → OpenRouter → Zen → rules
  → SSE stream: { type: "text" } deltas → { type: "done" } with validated AnalysisResult
  → Client: AnalysisRecord saved to localStorage
```

### Critical Path 2: Analysis Chat (grounded Q&A)

```
Chat Input → POST /api/analysis/chat
  → proxy.ts (CSRF check)
  → rateLimit (15/min/IP)
  → tryIncrement (chat_messages metric)
  → buildChatMessages (system prompt + grounding + history)
  → streamChatCompletion (OpenRouter-only)
  → SSE stream: { type: "text" } → { type: "done" }
  → Client: ChatTopic persisted to localStorage (and DB for signed-in users)
```

### Critical Path 3: User Registration & Sync

```
Register → POST /api/auth/register
  → rateLimitDb (10/min/IP)
  → scrypt password hash
  → INSERT users
  → Mailgun verification email (stateless HMAC token)
  → Verify → GET /api/auth/verify
  → bump auth_version → set session cookie

Sync → PUT /api/users/me
  → session auth → getCurrentUserId
  → LWW merge (updated_at) with server-side validation
  → batch INSERT/UPDATE
```

---

## Technology Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Framework** | Next.js | 16.3.1 | App Router, RSC, Server Actions, proxy.ts |
| **UI** | React | 19.2.0 | Latest stable; React 19 features (use, Server Components) |
| **Styling** | Tailwind CSS | 4.x | Utility-first; PostCSS plugin via @tailwindcss/postcss |
| **Language** | TypeScript | 5.x | Strict mode; project-wide type safety |
| **Database** | Turso (libSQL) | @libsql/client 0.17.4 | Edge-friendly SQLite; local file fallback for dev/test |
| **ORM/Driver** | None (raw SQL) | — | Direct SQL for full control; schema in src/lib/db/schema.ts |
| **AI Primary** | TokenRouter | OpenAI-compatible | Multi-model routing, auto-route fallback |
| **AI Secondary** | OpenRouter | OpenAI-compatible | Secondary cascade; chat mode (openrouter/free) |
| **AI Tertiary** | OpenCode Zen | OpenAI-compatible | Free models (big-pickle) |
| **Billing** | Stripe | 17.7.0 | Subscriptions, webhooks, checkout |
| **Email** | Mailgun | HTTP API | Transactional email, inbound forwarding |
| **Validation** | Zod | 4.4.3 | Schema validation for AI output + API inputs |
| **OCR** | Tesseract.js | 7.0.0 | Browser-side OCR for image uploads |
| **PDF** | pdfjs-dist + pdf-lib | 5.4.x / 1.17.x | PDF text extraction + manipulation |
| **DOCX** | mammoth | 1.11.0 | DOCX-to-text extraction |
| **Document AI** | MinerU Open SDK | 0.2.5 | Document-to-Markdown conversion |
| **Date parsing** | chrono-node | 2.10.1 | Natural language deadline detection |
| **Testing** | Vitest | 4.1.10 | Unit + integration tests; parallelized |
| **Linting** | ESLint | 9.x | Flat config; eslint-config-next |
| **Pre-commit** | Husky + lint-staged | 9.x / 15.x | Prettier + typecheck on commit |
| **Icons** | lucide-react | 0.562.0 | SVG icon library |

---

## Integration Points & External Dependencies

| Service | Contract | Env Vars | Failure Mode |
|---------|----------|----------|-------------|
| TokenRouter | OpenAI-compatible `/chat/completions` | `TOKENROUTER_API_KEY` | Cascade to OpenRouter → Zen → rules |
| OpenRouter | OpenAI-compatible `/chat/completions` | `OPENROUTER_API_KEY` | Cascade to Zen → rules |
| OpenCode Zen | OpenAI-compatible `/chat/completions` | `ZEN_API_KEY` | Cascade to rules |
| Turso | libSQL protocol (HTTP/TCP) | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Fatal in prod; local file in dev |
| Stripe | REST API + Webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing features unavailable |
| Mailgun | REST API (send, receive, inbound) | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Email features unavailable |
| MyMemory | REST API (translation) | — (free tier) | Translation unavailable |
| HuggingFace | CDN (ONNX model files) | — | Summarization unavailable |

---

## Non-Functional Requirements

### Scalability
- **Current:** Single-instance `next start` (vertical scaling).
- **Future:** Turso replicas for read scaling; in-memory rate limiter (process-scoped) acceptable for current scale; DB-backed rate limiting (`rateLimitDb.ts`) ready for multi-instance.

### Performance Budgets
- **Analysis (first token):** < 3s (P95) including provider latency.
- **Analysis (full):** < 30s for standard mode; < 60s for deep mode.
- **Chat response (first token):** < 5s (P95) via openrouter/free.
- **Page load (LCP):** < 3s on 3G; lazy-load analysis history.
- **Bundle size:** < 250 KB JS (excluding WASM workers loaded on demand).

### Availability
- **Target:** 99.5% uptime (self-hosted).
- **Degradation:** Rule-based fallback ensures analysis works without any AI provider.
- **Recovery:** `ensureSchema()` runs lazily; no manual migration steps.

### Disaster Recovery
- **Database:** Turso handles replication; local SQLite backed up via filesystem.
- **Local data:** Export JSON backup available in Settings.
- **Provider keys:** Environment-variable based; rotate by replacing and restarting.

---
