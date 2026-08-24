# 02 — Data Models & Contracts

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Entity/Domain Model

### Core Entities

#### User
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK | Cryptographic UUID |
| email | TEXT | UNIQUE, NOT NULL | User email |
| password_hash | TEXT | NOT NULL | scrypt hash |
| verified | INTEGER | NOT NULL, DEFAULT 0 | Email verified flag |
| email_verified_at | INTEGER | nullable | Verification timestamp |
| created_at | INTEGER | NOT NULL | Account creation timestamp |
| auth_version | INTEGER | NOT NULL, DEFAULT 0 | Session revocation counter |

#### AnalysisRecord
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK (per user) | Unique record id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| timestamp | INTEGER | NOT NULL | Analysis creation time |
| input | TEXT | NOT NULL | Original message text |
| output | TEXT | NOT NULL | JSON-serialized AnalysisResult |
| updated_at | INTEGER | NOT NULL, DEFAULT 0 | LWW clock for sync |
| deleted_at | INTEGER | nullable | Soft-delete tombstone |
| source_label | TEXT | nullable | File/upload label |

#### AnalysisResult (JSON schema inside output)
| Field | Type | Description |
|-------|------|-------------|
| actions | string[] | Imperative action items |
| deadlines | string[] | Extracted deadlines/timeframes |
| urgency | "Urgent" \| "Important" \| "Informational" | Urgency level |
| urgencyReason | string? | Short justification |
| urgencyConfidence | number? | 0.0–1.0 confidence |
| confusingParts | ConfusingPart[] | Material ambiguities |
| nextStep | string | Single best next action |
| nextStepReason | string? | Why this step |
| nextStepActionIndex | number? | Index into actions |
| summary | string | 2–3 sentence prose summary |
| analysisMethod | "ai" \| "fallback" | How it was analyzed |
| aiProviderUsed | string? | Which provider produced it |

#### ConfusingPart
| Field | Type | Constraints |
|-------|------|------------|
| sentence | string | required |
| explanation | string | required |
| reason | enum | "missing-info" \| "ambiguity" \| "contradiction" \| "jargon" \| "incomplete" |
| suggestion | string? | Clarification question |
| severity | enum? | "low" \| "medium" \| "high" |

#### BoardItem
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK (per user) | Unique item id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| source_id | TEXT | NOT NULL | Analysis record id |
| source_index | INTEGER | NOT NULL | Index into analysis actions |
| text | TEXT | NOT NULL | Action text |
| urgency | TEXT | NOT NULL | Urgency level |
| status | TEXT | NOT NULL | "todo" \| "in-progress" \| "done" |
| created_at | INTEGER | NOT NULL | Creation time |
| updated_at | INTEGER | NOT NULL, DEFAULT 0 | LWW clock |
| deleted_at | INTEGER | nullable | Soft-delete tombstone |

#### Template
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK (per user) | Unique template id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| name | TEXT | NOT NULL | Template name |
| content | TEXT | NOT NULL | Template text content |
| created_at | INTEGER | NOT NULL | Creation time |
| updated_at | INTEGER | NOT NULL, DEFAULT 0 | LWW clock |
| deleted_at | INTEGER | nullable | Soft-delete tombstone |

#### ChatTopic
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK (per user) | Unique topic id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| record_id | TEXT | NOT NULL | Analysis record id |
| title | TEXT | NOT NULL, DEFAULT '' | Conversation title |
| context_input | TEXT | NOT NULL, DEFAULT '' | Snapshot of original message |
| context_analysis | TEXT | NOT NULL, DEFAULT '{}' | Snapshot of analysis JSON |
| messages | TEXT | NOT NULL, DEFAULT '[]' | JSON array of ChatTopicMessage |
| created_at | INTEGER | NOT NULL | Creation time |
| updated_at | INTEGER | NOT NULL | Last update time |
| deleted_at | INTEGER | nullable | Soft-delete tombstone |

#### ChatTopicMessage
| Field | Type | Description |
|-------|------|-------------|
| role | "user" \| "assistant" | Speaker role |
| content | string | Message text |

#### Subscription
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| user_id | TEXT | PK, FK → users, CASCADE | Owner |
| stripe_customer_id | TEXT | NOT NULL, DEFAULT '' | Stripe customer |
| stripe_subscription_id | TEXT | NOT NULL, DEFAULT '' | Stripe subscription |
| status | TEXT | NOT NULL, DEFAULT 'free' | Subscription status |
| price_id | TEXT | nullable | Stripe price |
| current_period_end | INTEGER | nullable | Period end timestamp |
| plan | TEXT | NOT NULL, DEFAULT 'free' | "free" \| "pro" |
| updated_at | INTEGER | NOT NULL | Last update |

#### ProUsage
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| user_id | TEXT | NOT NULL | Owner |
| metric | TEXT | NOT NULL | Usage metric name |
| window_start | INTEGER | NOT NULL | Fixed window start |
| count | INTEGER | NOT NULL, DEFAULT 0 | Current count |
| PK | | (user_id, metric, window_start) | Composite key |

#### Reminder
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK | Unique reminder id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| analysis_id | TEXT | NOT NULL, DEFAULT '' | Related analysis |
| deadline_text | TEXT | NOT NULL | Original deadline text |
| due_at | INTEGER | NOT NULL | Calculated due timestamp |
| remind_at | INTEGER | NOT NULL | Notification timestamp |
| sent | INTEGER | NOT NULL, DEFAULT 0 | Sent flag |
| channel | TEXT | NOT NULL, DEFAULT 'email' | Delivery channel |
| created_at | INTEGER | NOT NULL | Creation time |

#### InboxMessage
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | TEXT | PK (per user) | Message id |
| user_id | TEXT | FK → users, CASCADE | Owner |
| provider | TEXT | NOT NULL | "mailgun" |
| external_id | TEXT | NOT NULL, DEFAULT '' | Provider message id |
| sender | TEXT | NOT NULL, DEFAULT '' | Sender address |
| subject | TEXT | NOT NULL, DEFAULT '' | Email subject |
| snippet | TEXT | NOT NULL, DEFAULT '' | First ~200 chars |
| received_at | INTEGER | NOT NULL | Receive timestamp |
| body | TEXT | NOT NULL, DEFAULT '' | Full email body |
| analysis_id | TEXT | NOT NULL, DEFAULT '' | Linked analysis |
| analyzed | INTEGER | NOT NULL, DEFAULT 0 | Analysis flag |
| replied | INTEGER | NOT NULL, DEFAULT 0 | Reply flag |
| created_at | INTEGER | NOT NULL | Creation time |

#### InboundRoute
| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| slug | TEXT | PK | Forwarding slug |
| user_id | TEXT | FK → users, CASCADE | Owner |
| active | INTEGER | NOT NULL, DEFAULT 1 | Active flag |
| created_at | INTEGER | NOT NULL | Creation time |

---

## Database Schema Decisions

### Normalization
- **3NF** for relational data (users, analyses, board_items, templates, chat_topics).
- **Denormalized JSON** for `chat_topics.messages` (array of role+content) — avoids N+1 joins for a self-contained unit of conversation.
- **Denormalized JSON** for `analyses.output` (full AnalysisResult) — the result is a closed blob read/written atomically.

### Indexing Strategy
| Table | Index | Purpose |
|-------|-------|---------|
| analyses | PK (user_id, id) | Primary lookup |
| board_items | PK (user_id, id) | Primary lookup |
| templates | PK (user_id, id) | Primary lookup |
| chat_topics | PK (user_id, id) | Primary lookup |
| chat_topics | idx_chat_topics_record (user_id, record_id, updated_at) | Lookup by analysis record |
| reminders | idx_reminders_due (user_id, sent, remind_at) | Cron sweep |
| inbox_messages | idx_inbox_user (user_id, provider) | Inbox listing |
| rate_limits | PK (key, window_start) | Rate limit lookup |
| pro_usage | PK (user_id, metric, window_start) | Usage metering |
| subscriptions | PK (user_id) | One subscription per user |

### Migration Approach
- Schema versioning via `schema_migrations` table (current: v7).
- `ensureSchema()` applies DDL idempotently on startup/request.
- Versioned migrations (v3–v7) for ALTER TABLE on existing databases.
- Fresh installs get full DDL from `SCHEMA_DDL`.

---

## API Contract Definitions

### POST /api/analyze/stream
- **Auth:** None (rate-limited by IP)
- **Request:** `{ text: string, deep?: boolean }`
- **Response:** SSE stream
  - `data: { type: "text", text: string }` (accumulated)
  - `data: { type: "done", text: string, result: AnalysisResult, method: "ai" | "fallback", provider?: string }`
  - `data: { type: "error", message: string }`
  - `data: { type: "ping" }` (heartbeat every 10s)
- **Status Codes:** 200 (stream), 400 (empty), 413 (too large), 429 (rate limited)

### POST /api/analysis/chat
- **Auth:** None (rate-limited by IP), usage metered for signed-in users
- **Request:** `{ message: string, originalMessage?: string, analysis?: object, history?: ChatTurn[] }`
- **Response:** SSE stream
  - `data: { type: "text", text: string }` (accumulated)
  - `data: { type: "done", text: string, method: "ai" }`
  - `data: { type: "error", message: string }`
  - `data: { type: "ping" }` (heartbeat every 10s)
- **Status Codes:** 200 (stream), 400 (empty), 413 (too large), 429 (rate limited/usage limit)

### POST /api/auth/register
- **Auth:** None
- **Request:** `{ email: string, password: string }`
- **Response:** `{ message: string }` (201) or `{ error: string }` (409 duplicate, 429 rate limited)
- **Side effect:** Sends verification email via Mailgun

### POST /api/auth/login
- **Auth:** None
- **Request:** `{ email: string, password: string }`
- **Response:** `{ user: { id, email } }` (200) or `{ error: string }` (401, 403 unverified, 429)

### GET /api/auth/verify?token=...
- **Auth:** Stateless HMAC token
- **Response:** Redirect to `/` (200) or `{ error: string }` (400/401)

### POST /api/auth/forgot-password
- **Auth:** None
- **Request:** `{ email: string }`
- **Response:** `{ message: string }` (200 always — prevents enumeration)

### POST /api/auth/reset-password
- **Auth:** Stateless HMAC token
- **Request:** `{ token: string, password: string }`
- **Response:** `{ message: string }` (200) or `{ error: string }` (400/401)

### GET/PUT/DELETE /api/users/me
- **Auth:** Session cookie
- **GET Response:** `{ user: { id, email }, analyses: [...], boardItems: [...], templates: [...], settings: {...} }`
- **PUT Request:** `{ analyses?: [...], boardItems?: [...], templates?: [...], settings?: {...}, lastSync?: number }`
- **PUT Response:** `{ synced: number, conflicts: number }`
- **DELETE Response:** `{ message: string }` (erases all user data)

### POST /api/share
- **Auth:** None (rate-limited by IP)
- **Request:** `{ timestamp, input, output, includeInput?, sensitive? }`
- **Response:** `{ id: string, url: string }`

### GET /api/share/[id]
- **Auth:** Encrypted token in URL
- **Response:** Shared analysis page (HTML)

### POST /api/translate
- **Auth:** None (rate-limited by IP)
- **Request:** `{ text: string, from?: string, to: string }`
- **Response:** `{ translation: string }`

### POST /api/billing/checkout
- **Auth:** Session + Pro gate
- **Request:** `{ priceId: string }`
- **Response:** `{ url: string }` (Stripe Checkout session)

### POST /api/billing/webhook
- **Auth:** Stripe signature verification
- **Request:** Stripe webhook event
- **Response:** 200 (processed) or 400 (invalid signature)

---

## Validation Rules

### Analysis Input
- `text`: required, string, 10–20,000 chars (free) / 50,000 chars (Pro)
- `deep`: optional boolean (default false)

### Chat Input
- `message`: required string, non-empty after trim, max 4,000 chars
- `originalMessage`: optional string, max 4,000 chars
- `analysis`: optional object (accepted as-is; server-side type check only)
- `history`: optional array of `{ role, content }`, max 20 turns, max 4,000 chars each

### Auth Input
- `email`: valid email format, max 320 chars
- `password`: min 8 chars, max 128 chars
- `token`: required string (HMAC verification)

### Sync Input (PUT /api/users/me)
- Each record validated against allow-list schema
- Invalid record → entire batch rejected (400)
- Max body size: 2 MB (413)

---

## State Machines

### AnalysisRecord Lifecycle
```
[Created] → [Synced] → [Deleted (soft)]
   │                      │
   └── (local only)       └── (tombstone preserved for LWW sync)
```

### BoardItem Lifecycle
```
[todo] → [in-progress] → [done]
  ↑                          │
  └──────────────────────────┘  (can revert)
```

### ChatTopic Lifecycle
```
[Created] → [Updated (messages appended)] → [Deleted (soft)]
```

### Subscription Lifecycle
```
[free] → [active] → [past_due] → [canceled]
  ↑       │
  │       └──→ [trialing] → [active]
  │
  └────────────────── [unpaid] → [canceled]
```

---

## Data Retention & Purge Policies

| Data | Retention | Mechanism |
|------|-----------|-----------|
| Analyses (local) | Indefinite (user-controlled) | localStorage; export/delete in Settings |
| Analyses (server) | Until user deletion | CASCADE delete from users table |
| Chat topics | Until user deletion | CASCADE delete |
| Board items | Until user deletion | CASCADE delete |
| Templates | Until user deletion | CASCADE delete |
| Reminders | Until sent or user deletion | CASCADE delete |
| Inbox messages | Until user deletion | CASCADE delete |
| Share links | 30 days | TTL check in `share-crypto.ts` |
| Session cookies | 30 days | `maxAge` in cookie |
| Rate limit buckets | 60s (in-memory) | Eviction on restart |
| Pro usage | Current window only | Fixed daily/monthly windows |
| Webhook events | Until processed | Dedupe table |

---
