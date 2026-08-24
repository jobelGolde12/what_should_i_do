# 03 — Component Breakdown

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Component Tree

```
src/
├── app/                          # Next.js App Router
│   ├── (workspace)/              # Route group (shared layout)
│   │   ├── page.tsx              # Home / input page
│   │   ├── analysis/[id]/        # Analysis result page
│   │   ├── analysis/[id]/chat/   # Chat with AI about analysis
│   │   ├── history/              # Past analyses list
│   │   ├── saved/                # Saved templates
│   │   ├── actions/              # Action board (Kanban)
│   │   ├── dashboard/            # Pro dashboard (analytics)
│   │   └── settings/             # User settings & billing
│   ├── auth/                     # Auth pages (login, register)
│   ├── share/[id]/               # Shared analysis view
│   ├── privacy/                  # Privacy policy
│   ├── terms/                    # Terms of service
│   ├── api/                      # API routes
│   │   ├── analyze/stream/       # SSE analysis endpoint
│   │   ├── analysis/chat/        # SSE chat endpoint
│   │   ├── auth/                 # Auth endpoints
│   │   ├── billing/              # Stripe billing
│   │   ├── share/                # Share link CRUD
│   │   ├── translate/            # Translation endpoint
│   │   ├── summarize/            # Summarization endpoint
│   │   ├── inbox/                # Inbox endpoints
│   │   ├── mailgun/              # Mailgun webhook
│   │   ├── reminders/            # Reminder CRUD
│   │   ├── cron/                 # Cron jobs (reminders, digest)
│   │   ├── users/                # User data sync
│   │   ├── settings/             # Settings endpoints
│   │   ├── convert/              # File conversion
│   │   ├── extract/              # Text extraction
│   │   ├── health/               # Health check
│   │   ├── debug/                # Debug routes (prod-gated)
│   │   └── chats/                # Chat topics CRUD
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── sitemap.ts                # Sitemap generation
│   ├── manifest.ts               # PWA manifest
│   ├── robots.ts                 # Robots.txt
│   └── not-found.tsx             # 404 page
├── components/                   # React components
│   ├── input/                    # InputArea, FileUpload, DragDrop
│   ├── analysis/                 # Analysis display components
│   ├── results/                  # ResultsPanel, TranslationBlock, etc.
│   ├── board/                    # Kanban board components
│   ├── chat/                     # AnalysisChatView, SafeMarkdown
│   ├── history/                  # History list components
│   ├── saved/                    # Template management
│   ├── settings/                 # Settings page components
│   ├── dashboard/                # Pro dashboard components
│   ├── inbox/                    # Inbox components
│   ├── auth/                     # Auth form components
│   ├── navigation/               # SmartLink, nav components
│   ├── share/                    # Share link components
│   ├── layout/                   # Header, Sidebar, Footer
│   ├── skeletons/                # Loading skeletons
│   └── ui/                       # Button, Tooltip, States, etc.
├── lib/                          # Shared utilities & core logic
│   ├── ai.ts                     # AI client (multi-provider cascade)
│   ├── ai-mock.ts                # Dev-only mock AI
│   ├── chat/                     # Chat provider (OpenRouter-only)
│   │   ├── config.ts             # Chat config resolution
│   │   └── provider.ts           # Chat streaming transport
│   ├── prompts.ts                # Versioned analysis + chat prompts
│   ├── validateAnalysis.ts       # Zod validation + repair
│   ├── analyzeRules.ts           # Rule-based fallback analyzer
│   ├── actionUtils.ts            # Action text cleaning/dedup
│   ├── streamParse.ts            # SSE/JSON parsing utilities
│   ├── errors.ts                 # Error types + factory
│   ├── types.ts                  # Shared TypeScript types
│   ├── storage.ts                # localStorage wrapper
│   ├── rateLimit.ts              # In-memory per-IP rate limiting
│   ├── rateLimitDb.ts            # DB-backed per-IP rate limiting
│   ├── log.ts                    # Structured logger (zero PII)
│   ├── format.ts                 # Text formatting utilities
│   ├── deadline.ts               # Deadline detection utilities
│   ├── urgency.ts                # Urgency classification utilities
│   ├── tts.ts                    # Text-to-speech (browser)
│   ├── mailgun.ts                # Mailgun API client
│   ├── share.ts                  # Share link management
│   ├── share-crypto.ts           # AES-256-GCM encryption
│   ├── backup.ts                 # JSON export/import
│   ├── sync.ts                   # Cloud sync logic
│   ├── cron.ts                   # Cron job utilities
│   ├── digest.ts                 # Weekly digest
│   ├── reminders.ts              # Reminder management
│   ├── ics.ts                    # ICS calendar export
│   ├── ads.ts                    # Ad integration
│   ├── batch.ts                  # Batch analysis
│   ├── batchAnalyze.ts           # Batch processing
│   ├── batchAnalyze.ts           # Batch processing
│   ├── mineru.ts                 # MinerU document conversion
│   ├── inbound.ts                # Inbound email processing
│   ├── replyFallback.ts          # Reply drafting fallback
│   ├── data-cache.tsx            # Data caching (React context)
│   ├── nav.ts                    # Navigation state
│   ├── navigation.tsx            # Navigation components
│   ├── features.ts               # Feature flags
│   ├── site.ts                   # Site configuration
│   ├── toast.ts                  # Toast notifications
│   ├── db/                       # Database layer
│   │   ├── index.ts              # DB client + schema init
│   │   ├── schema.ts             # DDL + migrations
│   │   └── types.ts              # DB types
│   ├── auth/                     # Authentication
│   │   ├── cookies.ts            # Session cookie management
│   │   ├── session.ts            # HMAC sign/verify
│   │   ├── users.ts              # User CRUD
│   │   └── validation.ts         # Sync record validation
│   ├── pro/                      # Pro/subscription
│   │   ├── plans.ts              # Plan tiers + limits
│   │   ├── entitlements.ts       # Entitlement checks
│   │   ├── usage.ts              # Usage metering
│   │   ├── billing.ts            # Stripe integration
│   │   ├── stripe.ts             # Stripe client
│   │   └── usePlan.ts            # Client-side plan hook
│   ├── convert/                  # File conversion
│   └── debug/                    # Debug utilities
├── context/                      # React contexts
│   └── AuthContext.tsx           # Auth state provider
└── proxy.ts                      # CSRF protection (Next.js proxy)
```

---

## Component Interfaces & Contracts

### AI Layer (`src/lib/ai.ts`)

```
interface AIClient {
  configured: boolean
  analyzeStructured(input: string): Promise<AIClientResult>
  streamText(messages: ChatMessage[], onDelta: (acc: string) => void, opts?): Promise<AIStreamResult>
  getDiagnostics(): ProviderDiagnostics
}
```

**Contract:** `analyzeStructured` returns `{ result: AnalysisResult, usage: AIUsage }` or throws `AnalysisError`. `streamText` calls `onDelta` with accumulated text for each SSE chunk and returns `{ content, usage }`.

### Chat Provider (`src/lib/chat/provider.ts`)

```
function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (accumulated: string) => void,
  options?: StreamChatOptions
): Promise<ChatStreamResult>
```

**Contract:** Streams one chat completion from OpenRouter. Retries transient failures only before first delta. Throws `ChatProviderError` with classified `kind` or `ChatCancelledError` on caller abort. Returns `{ content, actualModel, tokenUsage, latencyMs, attempts }`.

### Chat Config (`src/lib/chat/config.ts`)

```
function resolveChatConfig(env?): ResolvedChatConfig
```

**Contract:** Returns `{ ok: true, config: ChatProviderConfig }` or `{ ok: false, problem: ChatConfigProblem }`. Never throws.

### Validation (`src/lib/validateAnalysis.ts`)

```
function analyzeRawResponse(input: string | unknown): { result: AnalysisResult; repaired: boolean }
function validateAndRepairAnalysis(input: string | unknown): AnalysisResult
```

**Contract:** Parses, validates, and repairs AI output into a valid `AnalysisResult`. Throws on unusable output (empty, unparseable, no usable fields).

### Storage (`src/lib/storage.ts`)

```
function readStorage<T>(key: string, fallback: T): T
function writeStorage<T>(key: string, value: T): boolean
function uid(): string
```

**Contract:** `readStorage` returns parsed value or fallback (never throws). `writeStorage` returns success flag (fires custom event on failure). `uid` returns collision-resistant unique ID.

### Rate Limiting (`src/lib/rateLimit.ts`)

```
function rateLimit(ip: string, limit: number, windowMs?): RateLimitResult
function getClientIp(request: Request): string
```

**Contract:** `rateLimit` returns `{ allowed, remaining, resetAt }`. Per-process in-memory; resets on restart.

### Database (`src/lib/db/index.ts`)

```
function getDb(): TursoClient
async function ensureSchema(): Promise<void>
async function pingDb(): Promise<boolean>
```

**Contract:** `getDb` returns cached libSQL client (local file in dev, remote in prod). `ensureSchema` applies DDL idempotently. `pingDb` checks connectivity.

### Logging (`src/lib/log.ts`)

```
function logRequest(requestId, endpoint, meta?): void
function logError(requestId, endpoint, message): void
function logAuthEvent(event, meta?): void
function logSyncEvent(event, meta?): void
function maskEmail(email: string): string
```

**Contract:** Never logs analyzed text, passwords, or raw tokens. Email addresses are SHA-256 hashed before logging.

### Entitlements (`src/lib/pro/entitlements.ts`)

```
async function planForUser(userId: string | null): Promise<PlanTier>
async function limitsForUser(userId: string | null): Promise<PlanLimits>
async function proGate(userId: string | null): Promise<Response | null>
```

**Contract:** `planForUser` returns "free" or "pro" based on DB subscription. `proGate` returns 403 Response or null (allowed).

---

## Dependency Graph

```
proxy.ts (standalone)
    │
    ▼
api/ routes ──→ lib/ai.ts ──→ lib/validateAnalysis.ts
    │               │                │
    │               │                └─→ lib/actionUtils.ts
    │               │                └─→ lib/analyzeRules.ts
    │               │                └─→ lib/streamParse.ts
    │               │
    │               └─→ lib/prompts.ts
    │
    ├──→ lib/chat/provider.ts ──→ lib/chat/config.ts
    │
    ├──→ lib/rateLimit.ts
    ├──→ lib/rateLimitDb.ts ──→ lib/db/
    ├──→ lib/log.ts
    ├──→ lib/auth/cookies.ts ──→ lib/auth/session.ts
    │                          ──→ lib/auth/users.ts ──→ lib/db/
    ├──→ lib/pro/entitlements.ts ──→ lib/db/
    │                            ──→ lib/pro/plans.ts
    ├──→ lib/pro/usage.ts ──→ lib/db/
    └──→ lib/pro/billing.ts ──→ lib/pro/stripe.ts

components/ ──→ lib/storage.ts (client-side)
            ──→ lib/types.ts
            ──→ context/AuthContext.tsx ──→ lib/pro/usePlan.ts
            ──→ lib/format.ts
            ──→ lib/navigation.tsx
```

**Circular dependency check:** No circular dependencies detected. All imports flow from routes → lib → db; from components → lib/storage + context.

---

## Responsibility Assignment Matrix

| Component | Functional Requirements |
|-----------|------------------------|
| `ai.ts` | Multi-provider cascade, circuit breakers, retry/backoff, structured analysis, streaming |
| `chat/provider.ts` | Chat streaming, error normalization, idle watchdog, retry (pre-delta only) |
| `chat/config.ts` | Chat provider config resolution (OpenRouter-only) |
| `prompts.ts` | Versioned prompt construction (analysis, chat, reply) |
| `validateAnalysis.ts` | Schema validation, repair, JSON salvage |
| `analyzeRules.ts` | Rule-based fallback analysis |
| `storage.ts` | localStorage CRUD with error handling |
| `rateLimit.ts` | In-memory per-IP rate limiting |
| `rateLimitDb.ts` | DB-backed per-IP rate limiting |
| `db/index.ts` | Database client lifecycle, schema init |
| `db/schema.ts` | DDL, migrations, version tracking |
| `auth/cookies.ts` | Session cookie management |
| `auth/session.ts` | HMAC sign/verify |
| `auth/users.ts` | User CRUD |
| `pro/entitlements.ts` | Plan resolution, Pro gating |
| `pro/usage.ts` | Usage metering (atomic tryIncrement) |
| `pro/billing.ts` | Stripe checkout, portal, webhooks |
| `log.ts` | Structured logging (zero PII) |
| `share.ts` | Share link management |
| `share-crypto.ts` | AES-256-GCM encryption |
| `proxy.ts` | CSRF cross-origin protection |
| Components | UI rendering, user interaction, state management |

---

## Error Handling Strategy

| Layer | Error Type | Handling |
|-------|-----------|---------|
| **AI Provider** | Network/timeout | Exponential backoff, circuit breaker, cascade to next provider |
| **AI Provider** | Quota exhaustion | Stop provider cascade; surface ALL_KEYS_EXHAUSTED to user |
| **AI Provider** | Schema/JSON invalid | Salvage partial JSON; retry on next route |
| **Chat Provider** | Network/timeout | Retry with backoff (pre-delta only); idle watchdog |
| **Chat Provider** | Auth/rate-limit | Classify as ChatErrorKind; friendly copy to client |
| **Chat Provider** | Partial stream delivered | Never retry (would duplicate deltas) |
| **Validation** | Invalid AI output | Auto-repair (coerce arrays, clamp urgency); throw if unusable |
| **Rate Limiter** | Limit exceeded | Return 429 with friendly error message |
| **Database** | Connection failure | Fatal in prod; local file fallback in dev |
| **Database** | Schema migration | Best-effort (idempotent ALTERs) |
| **Auth** | Invalid session | Return null; user treated as anonymous |
| **Auth** | Revoked session | Reject (auth_version mismatch) |
| **Sync** | Invalid record | Reject entire batch (400) |
| **CSRF** | Cross-origin mutation | Return 403 |
| **Share** | Expired/invalid token | Return 404 |
| **Billing** | Webhook failure | Log error; return 200 (avoid Stripe retry storm) |
| **Component** | Render error | Error boundary fallback (placeholder UI) |
| **Storage** | Quota exceeded | Dispatch custom event for UI notification |

---
