# Environment Setup — TaskMind QA

**Date:** 2026-08-15
**Host:** Linux, repo `/home/jobel/projects/taskmind`, branch `main2`

---

## 1. Prerequisites

- Node.js (project runs Next.js 14.2.35; vitest 4.1.10).
- `npm install` complete.
- Local `sqlite3` CLI (for test-DB manipulation).

## 2. Secrets & Configuration Handling

**IMPORTANT:** The repo's `.env` contains **real production secrets** (TokenRouter, OpenRouter, Mailgun incl. webhook signing key, Turso, AUTH_SECRET, SHARE_SECRET, CRON_SECRET). These were **never read or printed**. QA used only `.env.example` key names.

QA ran servers with **process-level overrides exported before the Next.js command** so the process environment wins over `.env` loading:

```bash
export TURSO_DATABASE_URL="file:/tmp/opencode/taskmind-test.db" \
       MAILGUN_API_KEY="" MAILGUN_DOMAIN="" MAILGUN_FROM="" MAILGUN_BASE_URL="" \
       TOKENROUTER_API_KEY="" TOKENROUTER_BASE_URL="" TOKENROUTER_MODEL="" \
       OPENROUTER_API_KEY="" OPENROUTER_BASE_URL="" \
       STRIPE_SECRET_KEY="" STRIPE_WEBHOOK_SECRET="" \
       AUTH_SECRET="qa-dev-auth-secret" SHARE_SECRET="qa-dev-share-secret" \
       CRON_SECRET="qa-cron-secret" ADMIN_TOKEN="qa-admin-token" \
       TRUST_PROXY=0
```

Verified in the running process (`/proc/<pid>/environ`): the overrides held (e.g. `MAILGUN_API_KEY=EMPTY`, `TURSO_DATABASE_URL=file:<local>`). Empty strings were correctly honored by `next start`.

**Why:** prevents any real email, Stripe charge, or paid AI call during testing, and keeps the DB fully local.

## 3. Database

- Local libSQL/SQLite file: `/tmp/opencode/taskmind-test.db` (never the real Turso DB).
- Schema auto-created on first boot by the app.
- Test accounts created via the running app (register endpoint) or direct inserts for verification toggles.

## 4. Starting Servers

### Production server (primary target)
```bash
npm run build                 # also captures build analysis
export <overrides from §2>
setsid nohup npm run start > /tmp/opencode/prod-server.log 2>&1 & disown
```
- Listens on `127.0.0.1:3000`. **Use `127.0.0.1`, not `localhost`** (IPv6 resolution caused curl `000` errors in this environment).

### Dev server (for dev-mode behaviors + registration auto-verify)
```bash
export <overrides from §2>
setsid nohup npm run dev -- -p 3001 > /tmp/opencode/dev3001.log 2>&1 & disown
```

## 5. Test Accounts

| Email | Password | Plan | Purpose |
|---|---|---|---|
| `qa.user@example.com` | `QaTestPass123` | Pro | Main black-box functional run |
| `ua@example.com` / `ub@example.com` | `QaTestPass123` | Pro | Cross-user isolation (IDOR) |

- Registered via the app in dev mode (Mailgun empty → auto-verified path).
- Pro granted by inserting into `subscriptions` (`user_id`, `plan='pro'`, `status='active'`) — mirrors the effect of a real Stripe webhook without Stripe.
- Cleaned up at the end of the cycle (account deletion via `DELETE /api/users/me`).

## 6. Request Helpers

Cookie jars preserve the `taskmind_session` cookie across requests:

```bash
curl -c ua.cookie -X POST http://127.0.0.1:3001/api/auth/login \
     -H "Content-Type: application/json" -d '{"email":"ua@example.com","password":"QaTestPass123"}'
curl -b ua.cookie http://127.0.0.1:3001/api/reminders?analysisId=IDOR-TEST
```

SSE streams use `curl -N --max-time 20` to read the `data:` events.

## 7. Verification Commands

| Command | Expected |
|---|---|
| `npm test` | 243 passed (18 files) |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | exit 0, 39 static pages |
| `npm audit --omit=dev` | 7 vulnerabilities (6 high, 1 critical) — see dependency scan |

## 8. Known Environment Quirks

- Dev-mode `POST /api/convert` crashes at module load (`TypeError: Object.defineProperty called on non-object` from `pdfjs-dist/legacy/build/pdf.mjs` via `src/lib/convert/index.ts:14`). Production build unaffected — this is a dev-workflow bug.
- `/api/debug/health` and `/api/debug/env` are statically prerendered (`○`) at build time; they serve build-time data, not live state.
- Rate-limit windows are fixed 60-second buckets; hammer tests must be spaced accordingly.
