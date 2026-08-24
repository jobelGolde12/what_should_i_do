# 08 — DevOps & Deployment

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Environment Strategy

### Development
- **Local:** `npm run dev` (Next.js dev server with hot reload)
- **Database:** Local SQLite file (`.data/taskmind.db`) — no Turso URL needed
- **AI:** Real providers (TokenRouter/OpenRouter) or `AI_MOCK=1` for offline mode
- **Auth:** Working locally; Mailgun needs real API key for email verification
- **Build flag:** `--webpack` (required for native module externals)

### Staging
- **Database:** Turso staging instance (separate from production)
- **AI:** Same providers with staging API keys
- **Auth:** Real Mailgun domain (staging)
- **Stripe:** Test mode keys
- **Purpose:** Pre-production validation

### Production
- **Database:** Turso production instance
- **AI:** Production API keys with circuit breakers
- **Auth:** Production Mailgun domain; AUTH_SECRET rotated
- **Stripe:** Live mode keys
- **Monitoring:** Structured logs → stdout → log aggregation

### Parity Rules
- **Environment variables:** Identical structure across environments; values differ
- **Schema:** Same DDL; migrations run automatically on startup
- **Build:** Same `next build --webpack` command
- **Runtime:** Same `next start` command

---

## Containerization Specification

### Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/self-host-assets.mjs
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### Build Requirements
- **Node.js 22+** (required for Next 16 / sharp 0.35)
- **npm** (package-lock.json committed)
- **Native modules:** `@xenova/transformers`, `onnxruntime-node`, `pdfjs-dist` externalized via webpack config
- **Asset self-hosting:** `scripts/self-host-assets.mjs` copies WASM workers to `public/`

### Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))"
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI/CD

on:
  push:
    branches: [main, main2]
  pull_request:
    branches: [main, main2]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run security:audit

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test, security]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
```

### Pipeline Stages
```
lint ─────────┐
typecheck ────┼──→ build ──→ deploy
test ─────────┤
security ─────┘
```

### Quality Gates
- **Lint:** ESLint with eslint-config-next (flat config)
- **Typecheck:** `tsc --noEmit` (strict mode)
- **Tests:** All 247 tests must pass
- **Security:** `npm audit --omit=dev` must report 0 vulnerabilities
- **Build:** `next build --webpack` must succeed

---

## Infrastructure-as-Code Requirements

### Current State
- **No IaC:** Deployment is manual (`npm run build && npm start`)
- **Database:** Turso provisioned via dashboard
- **Email:** Mailgun provisioned via dashboard
- **Billing:** Stripe provisioned via dashboard

### Recommended IaC (Future)
- **Terraform/Pulumi:** Manage Turso database, Mailgun domain, Stripe products
- **GitHub Actions:** Automated deployment on merge to main
- **Environment variables:** Managed via deployment platform (Vercel, Railway, etc.)

---

## Monitoring, Logging & Alerting

### Current Stack
- **Logging:** Structured JSON logs via `src/lib/log.ts`
- **Log format:** `{ t: ISO timestamp, level, scope, ...metadata }`
- **Log transport:** stdout (no external aggregation yet)
- **PII policy:** Never log analyzed text, passwords, or raw tokens

### Monitoring Requirements

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Request latency (P95) | Structured logs | > 5s |
| Error rate | Structured logs | > 5% of requests |
| AI provider failures | Circuit breaker state | Breaker open |
| Rate limit hits | Rate limit logs | > 100/min |
| Database connectivity | `pingDb()` | Connection failure |
| Memory usage | Node.js process | > 512 MB |
| CPU usage | Node.js process | > 80% sustained |

### Alerting (Recommended)
- **Error tracking:** Sentry or similar (Feature 21 deferred)
- **Uptime:** Health check monitoring (e.g., Betterstack, UptimeRobot)
- **Logs:** Ship to centralized log aggregation (e.g., Datadog, Logtail)
- **Alerts:** Email/Slack on error rate spikes or health check failures

---

## Backup & Restore Procedures

### Database Backup
- **Turso:** Built-in replication and point-in-time recovery
- **Local SQLite:** File copy (`.data/taskmind.db`)
- **Frequency:** Turso handles continuous replication; manual backup before migrations

### User Data Export
- **Settings → Export:** JSON download of all user data (analyses, board items, templates, chats)
- **Format:** `{ analyses: [...], boardItems: [...], templates: [...], chats: [...] }`
- **Import:** Available in Settings for data restoration

### Disaster Recovery Steps
1. **Database failure:** Turso failover to replica; or restore from backup
2. **Application failure:** Restart `next start`; `ensureSchema()` re-applies DDL
3. **Provider failure:** Circuit breaker skips to next provider; rule-based fallback
4. **Key rotation:** Replace env var; restart (circuit breaker state resets)

---

## Deployment Checklist

### Pre-Deployment
- [x] All CI checks pass (lint, typecheck, test, security)
- [x] Build succeeds (`npm run build`)
- [x] Environment variables configured:
  - [x] `AUTH_SECRET` (new random value)
  - [x] `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
  - [x] `TOKENROUTER_API_KEY`
  - [x] `OPENROUTER_API_KEY` (+ `OPENROUTER_CHAT_API_KEY` if separate)
  - [x] `ZEN_API_KEY`
  - [x] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  - [x] `MAILGUN_API_KEY` + `MAILGUN_DOMAIN`
  - [x] `SHARE_SECRET`
  - [x] `ADMIN_TOKEN` (for debug routes)
  - [x] `CRON_SECRET` (for cron jobs)
  - [x] `NEXT_PUBLIC_APP_URL`

### Deployment
- [x] Run `npm run build` on production server
- [x] Start with `npm start` (or `node server.js` for standalone)
- [x] Verify health check: `curl http://localhost:3000/api/health`
- [x] Verify database connectivity: `ensureSchema()` runs on first request
- [x] Verify AI providers: submit a test analysis
- [x] Verify auth: register a test account
- [x] Verify Stripe: create a test checkout session
- [x] Verify Mailgun: send a test verification email

### Post-Deployment
- [x] Monitor error logs for 15 minutes
- [x] Check circuit breaker state: `GET /api/debug/ai` (if ADMIN_TOKEN set)
- [x] Verify rate limiting works
- [x] Test share link creation and decryption
- [x] Run `npm run security:audit` one final time

---
