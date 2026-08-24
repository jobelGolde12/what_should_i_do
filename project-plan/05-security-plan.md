# 05 — Security Plan

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Authentication Mechanism

### Session Management
- **Type:** HMAC-signed HTTP-only cookies (`taskmind_session`)
- **Signing:** HMAC-SHA256 with `AUTH_SECRET` env var
- **SameSite:** Lax
- **Secure:** true in production
- **Max Age:** 30 days
- **Revocation:** `users.auth_version` incremented on every security event; sessions signed with older versions are rejected on every authenticated read

### Password Hashing
- **Algorithm:** scrypt (Node.js crypto module)
- **Comparison:** Timing-safe compare (`crypto.timingSafeEqual`)
- **Storage:** Only the hash is stored; plaintext never persisted

### Stateless Email Tokens
- **Verification:** HMAC-signed URL with `auth_version` stamp, 24h expiry
- **Password Reset:** HMAC-signed URL with `auth_version` stamp, 1h expiry
- **Single-use:** Enforced by `auth_version` bump on consume; no DB token storage needed
- **Replay protection:** Token includes version; rotation invalidates all prior tokens

### Session Lifecycle
```
Register → Verify (bump auth_version) → Login (set cookie)
  → Password change (bump auth_version → revoke all sessions)
  → Reset password (bump auth_version → revoke all sessions)
```

---

## Authorization Model

### Role-Based Access Control (RBAC)

| Resource | Anonymous | Free User | Pro User | Admin |
|----------|-----------|-----------|----------|-------|
| Analyze text | ✅ (rate-limited) | ✅ (metered) | ✅ (metered, higher limits) | ✅ |
| Chat with AI | ✅ (rate-limited) | ✅ (metered) | ✅ (metered, higher limits) | ✅ |
| View shared analysis | ✅ | ✅ | ✅ | ✅ |
| Create share link | ✅ (rate-limited) | ✅ | ✅ | ✅ |
| Sync data | ❌ | ❌ | ✅ | ✅ |
| Reply drafting | ❌ | ❌ | ✅ | ✅ |
| Deep analysis | ❌ | ❌ | ✅ | ✅ |
| Inbox | ❌ | ❌ | ✅ | ✅ |
| Reminders | ❌ | ❌ | ✅ | ✅ |
| Batch analysis | ❌ | ✅ (1 item) | ✅ (up to 20) | ✅ |
| Export | ❌ | ❌ | ✅ | ✅ |
| Debug routes | ❌ | ❌ | ❌ | ✅ (ADMIN_TOKEN) |
| Delete account | ❌ | ✅ | ✅ | ✅ |

### Enforcement Points
- **Server-side:** Every Pro-only endpoint calls `proGate(userId)` at the top; returns 403 if not Pro.
- **Client-side:** `usePlan()` hook shows/hides UI elements; never trusted for enforcement.
- **Usage metering:** `tryIncrement()` is atomic (single SQL statement) — concurrent requests can't both slip past the cap (SEC-19).

---

## Input Sanitization & Output Encoding

### Input Sanitization
- **Text length limits:** All public endpoints enforce max chars (10K–50K depending on plan).
- **Body size limits:** POST /api/analysis/chat rejects payloads > 256 KB (413).
- **History sanitization:** Server-side re-validation of client-supplied chat history (role, content type, length bounds).
- **Type checking:** `typeof body.analysis === "object"` before acceptance; non-objects default to `{}`.
- **Auth input:** Email validated as valid email format; password min/max length enforced.

### Output Encoding
- **React rendering:** All AI/streamed output is rendered as React text nodes (no `dangerouslySetInnerHTML`).
- **SafeMarkdown component:** Strips dangerous HTML; allows only safe markdown (bold, italic, links, code, lists).
- **SSE encoding:** `TextEncoder` for SSE frames; JSON-serialized payloads.
- **Error messages:** User-friendly copy only; raw provider errors, request IDs, and token counts never reach the client.
- **Share links:** Encrypted tokens (AES-256-GCM); raw input never in URL; `sensitive` payloads stripped before client sees them.

---

## CSRF / XSS / Injection Mitigation

### CSRF Protection (`src/proxy.ts`)
- **Defense-in-depth:** Origin header check on all mutation requests (POST/PUT/PATCH/DELETE).
- **SameSite=Lax cookies:** Blocks classic cross-site POST cookie forgery.
- **Allow-list:** `CSRF_ALLOWED_ORIGINS` env var for subdomain exceptions.
- **Webhook bypass:** No Origin header → pass through (Mailgun, Stripe, cron, curl).

### XSS Prevention
- **React default:** All output rendered as text nodes.
- **CSP headers:** Production-only `Content-Security-Policy` in `next.config.js`:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (needed by pdfjs/tesseract WASM)
  - `object-src 'none'`
  - `frame-ancestors 'none'`
- **Static injection only:** `dangerouslySetInnerHTML` used only for static JSON-LD and theme boot script.

### SQL Injection Prevention
- **Parameterized queries:** All SQL uses `?` placeholders via libSQL client.
- **No string interpolation:** Never construct SQL from user input.
- **Schema validation:** Sync records validated against allow-list before database write.

### Command Injection Prevention
- **No shell execution:** Application does not execute shell commands.
- **File processing:** Uses Node.js libraries (pdfjs-dist, mammoth, tesseract.js) — no child processes.

---

## Secrets Management

### Approach
- **Environment variables only:** All secrets injected at runtime via env.
- **No hardcoding:** Never commit secrets to source files.
- **Gitignored:** `.env*` and `.data/` in `.gitignore`.
- **Server-only:** AI API keys, Stripe keys, Mailgun keys, AUTH_SECRET — all server-side only.
- **Debug gating:** `ADMIN_TOKEN` required for debug routes in production.

### Key Inventory

| Secret | Purpose | Rotation |
|--------|---------|----------|
| `AUTH_SECRET` | HMAC session signing | Replace env + restart (revokes all sessions) |
| `TOKENROUTER_API_KEY` | AI provider (primary) | Replace env + restart (circuit breaker resets) |
| `OPENROUTER_API_KEY` | AI provider (secondary) + Chat mode | Replace env + restart |
| `ZEN_API_KEY` | AI provider (tertiary) | Replace env + restart |
| `STRIPE_SECRET_KEY` | Billing | Replace env + restart |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Replace in Stripe dashboard + env |
| `MAILGUN_API_KEY` | Email sending | Replace in Mailgun dashboard + env |
| `TURSO_AUTH_TOKEN` | Database access | Replace in Turso dashboard + env |
| `SHARE_SECRET` | AES-256-GCM encryption | Replace env + restart (existing links invalidated) |
| `ADMIN_TOKEN` | Debug route access | Replace env + restart |
| `CRON_SECRET` | Cron job authentication | Replace env + restart |

---

## Dependency Vulnerability Scanning

### Cadence & Tooling
- **CI:** `npm audit --omit=dev` runs on every PR (configured in `package.json` as `security:audit`).
- **Manual:** Run before each release.
- **Known overrides:** `protobufjs ^7.6.3`, `sharp ^0.35.0`, `underscore ^1.13.6` clear the audit chain.
- **Current status:** 0 vulnerabilities (verified 2026-08-25).

### Dependency Risk Register

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| `@xenova/transformers` | Pulls `onnxruntime-web` → `protobufjs` | Override to `^7.6.3`; WASM runs server-side only |
| `mammoth` | Pulls `underscore` (prototype pollution history) | Override to `^1.13.6`; docx extraction only |
| `pdfjs-dist` | Large WASM; externalized via webpack | Loaded on demand; not in main bundle |
| `tesseract.js` | Large WASM workers | Loaded on demand via web workers |
| `mineru-open-sdk` | External service dependency | Used server-side only |

---

## Security Headers

Configured in `next.config.js`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), ...` | Disable unused APIs |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforce HTTPS (prod) |
| `Content-Security-Policy` | (see XSS section) | Restrict resource loading (prod) |

---

## Data Encryption

### At-Rest
- **Database:** Turso manages encryption at rest (cloud); local SQLite file is unencrypted (acceptable for dev/test).
- **localStorage:** Browser-managed; no additional encryption (data is user-owned).

### In-Transit
- **HTTPS:** Enforced in production via HSTS header.
- **AI providers:** All API calls use HTTPS (TokenRouter, OpenRouter, Zen, MyMemory).
- **Database:** Turso uses TLS for remote connections.

### Field-Level
- **Share links:** AES-256-GCM encrypted tokens (`SHARE_SECRET` or `AUTH_SECRET` fallback).
- **Session tokens:** HMAC-signed (not encrypted — contains user ID, email, auth_version).
- **Passwords:** scrypt hashed (irreversible).
- **Email addresses in logs:** SHA-256 truncated fingerprint only (`maskEmail`).

---

## Known Security Risks & Mitigations

| Risk | Status | Mitigation |
|------|--------|------------|
| CSP relies on `unsafe-inline` / `unsafe-eval` | Accepted (deferred) | Per-request nonces require custom Node server; CSP strict on all other directives |
| No Sentry/error tracking | Deferred (Feature 21) | Add without logging text content |
| Share links have 30-day TTL | Mitigated | TTL check in `share-crypto.ts`; legacy decode removed |
| In-memory rate limiting resets on restart | Accepted | Deploy behind reverse proxy for stricter limiting; DB-backed for auth ops |
| Local SQLite unencrypted | Accepted (dev/test only) | Production uses Turso (encrypted at rest) |

---
