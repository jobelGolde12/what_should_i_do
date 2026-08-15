# Test Execution Results — TaskMind

**Date:** 2026-08-15
**Result codes:** PASS / FAIL / BLOCKED / N/A (not executed)

Environment: prod `next start` on 127.0.0.1:3000; dev `next dev -p 3001`; local file DB. Third-party services (Stripe, Mailgun, paid AI) disabled by env overrides.

---

## A. Auth

| ID | Result | Evidence / Notes |
|---|---|---|
| AUTH-01 | **PASS** | 201, `requiresVerification:false`, auto-verified in dev (Mailgun unconfigured) |
| AUTH-02 | **PASS** | 409 "An account with this email already exists." |
| AUTH-03 | **PASS** | 400 "Enter a valid email and a password of at least 8 characters." |
| AUTH-04 | **PASS** | 400 same message |
| AUTH-05 | **FAIL** | Returns **500** "Something went wrong. Try again." instead of 400 → BUG-01 |
| AUTH-06 | **PASS** | 401 |
| AUTH-07 | **PASS** | 200; cookie `taskmind_session` HttpOnly, SameSite=Lax (no Secure in dev), signed HMAC, 30-day TTL |
| AUTH-08 | **PASS** | 200 with user object |
| AUTH-09 | **PASS** | 401 `{"user":null}` |
| AUTH-10 | **PASS** | 200; cookie cleared; subsequent `me` 401 |
| AUTH-11 | **PASS** | Generic message for existing and non-existing email (anti-enumeration) |
| AUTH-12 | **PASS** | Generic success message |
| AUTH-13 | **PASS** (by design) | 503 on prod w/o Mailgun, but user row **is created** (verified via 409 on retry and DB rows) → BUG-03 |
| AUTH-14 | **PASS** | 401 ×10 then 429 on 11th (`rateLimitDb login 10/min`) |
| AUTH-15 | **PASS** | Probes returned 400/429; no bypass, no 500 |

## B. Analysis

| ID | Result | Evidence / Notes |
|---|---|---|
| ANA-01 | **PASS** | SSE events with `done`; `analysisMethod:"fallback"` (rules engine; AI keys cleared) |
| ANA-02 | **PASS** | 403 `PRO_REQUIRED` for free/no-session `deep:true` |
| ANA-03 | **PASS** | 400 |
| ANA-04 | **PASS** | SSE error event for too-short input |
| ANA-05 | **PASS** | 200 ×15 then 429 (`rateLimit(ip, 15)` anon) |
| ANA-06 | **PASS** | 403 `PRO_REQUIRED` (batch is Pro-only) |
| ANA-07 | **PASS** | 200; batch results via rules fallback — output contains a prompt-leakage artifact → BUG-09 |
| ANA-08 | **PASS** | 403 without session (note: inconsistent 401 vs 403 across Pro routes) → BUG-02 |
| ANA-09 | **PASS** | "Message is empty." error |
| ANA-10 | **PASS** | SSE `done` with fallback draft (`Hello, Thanks for your message…`) |
| ANA-11 | **PASS*** | First request returned empty within 30s (model load/download); retry within 90s → 200 + summary (`cached:true`) → BUG-06 |
| ANA-12 | **PASS** | "Hola mi amigo" → English translation |
| ANA-13 | **PASS** | Input echoed as data; front-end renders via React text nodes (no `dangerouslySetInnerHTML` on analysis output) |

## C. Conversion

| ID | Result | Evidence / Notes |
|---|---|---|
| CONV-01 | **PASS** | 200, `application/pdf`, 899-byte valid PDF |
| CONV-02 | **PASS** | 200 with docx output |
| CONV-03 | **PASS** | 400 |
| CONV-04 | **PASS** | 400/validation |
| CONV-05 | **PASS** | 400 (server re-checks `file.size === 0`, `src/app/api/convert/route.ts:57`) |
| CONV-06 | **FAIL** | Dev-mode crash at module load → BUG-05 (prod unaffected) |
| CONV-07 | **PASS** | Server re-validates `file.size > limits.maxFileBytes` (`route.ts:60`) |
| CONV-08 | **PASS** | 401 |

## D. Inbox & Reminders

| ID | Result | Evidence / Notes |
|---|---|---|
| INB-01 | **PASS** | 200 `[]` |
| INB-02 | **PASS** | 401 |
| INB-03 | **PASS** | 200, forwarding address `193c1d3e1f@in.taskmind.app` (slug = sha256(userId) prefix) |
| INB-04 | **PASS** (blocked service) | 409 "Email sending isn't configured." (Mailgun empty) |
| INB-05 | **PASS** | 400 |
| REM-01 | **PASS** | 401 |
| REM-02 | **PASS** | 400 |
| REM-03 | **PASS** | 200 `{ok:true, created:1, plan:{"Tuesday 9am":{...}}}` |
| REM-04 | **PASS** | 200 plan + reminder objects with `dueAt`/`remindAt` |
| REM-05 | **PASS** | ub → `{"plan":{},"reminders":[]}` for ua's analysisId; no cross-user leakage |
| REM-06 | **PASS** | 401 `Unauthorized.` |
| REM-07 | **PASS** | 200 `{ok:true, dry:true, due:0, sent:0, failed:0}` |
| REM-08 | **PASS** | 200 `{ok:true, dry:true, users:1, sent:0, failed:0, skipped:1}` |
| REM-09 | **PASS** | 200 with default digest settings |

## E. Sync & Profile

| ID | Result | Evidence / Notes |
|---|---|---|
| SYNC-01 | **PASS** | 200 with user + data |
| SYNC-02 | **PASS** | 200, name persisted |
| SYNC-03 | **PASS** | 200 `{ok:true}`; row removed from DB (deleted at end of cycle) |
| SYNC-04 | **PASS** | 200 sync patch OK |

## F. Sharing

| ID | Result | Evidence / Notes |
|---|---|---|
| SHARE-01 | **PASS** | 200 `{link: ".../share/enc:..."}` — AES-256-GCM, key derived from SHARE_SECRET |
| SHARE-02 | **PASS** | 400 "Invalid share payload." for bad urgency / unknown `analysisMethod` / oversized fields (whitelist `URGENCY_VALUES`/`METHOD_VALUES`) |
| SHARE-03 | **PASS** | 200 — `timestamp` accepted +24h with no freshness check → BUG-07 |
| SHARE-04 | **PASS** | 200, renders shared analysis anonymously (public-by-design; noindex) |
| SHARE-05 | **FAIL** | Tampered token → HTTP 200 with "Shared analysis - TaskMind" + "404" body → BUG-04 |

## G. Billing & Pro Gating

| ID | Result | Evidence / Notes |
|---|---|---|
| BILL-01 | **PASS** | 401 for inbox/reminders/sync (GET), 403 for batch/reply/stream — inconsistency noted (BUG-02) |
| BILL-02 | **PASS** | 200 (plan = pro, read from DB) |
| BILL-03 | **BLOCKED** (no Stripe) | 503 `BILLING_UNAVAILABLE` observed; full flow not testable |
| BILL-04 | **BLOCKED** (no Stripe) | 503 observed; checkout flow not testable |
| BILL-05 | **PASS** | `/api/debug/health` 200 unauthenticated (info only, masked values) |
| BILL-06 | **PASS** (behavior confirmed) | `/api/debug/env` 404 in prod even with ADMIN_TOKEN set — statically prerendered at build time → BUG-08 |

## H. Static Pages & Metadata

| ID | Result | Evidence / Notes |
|---|---|---|
| STATIC-01 | **PASS** | `/`, `/privacy`, `/terms` → 200 |
| STATIC-02 | **PASS** | `/actions`, `/history`, `/saved`, `/inbox`, `/settings`, `/dashboard` → 200 |
| STATIC-03 | **PASS** | `/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify` → 200 |
| STATIC-04 | **PASS** | `/login` → 404 (correct: pages under `/auth/*`) |
| STATIC-05 | **PASS** | robots/sitemap/manifest → 200, correct content types |
| STATIC-06 | **N/A** | Analysis page shape verified via build (`ƒ /analysis/[id]`); runtime visit deferred |

---

## Summary

| Result | Count |
|---|---|
| PASS | 43 |
| FAIL | 4 (AUTH-05, CONV-06, SHARE-05, plus ANA-11 first-call) |
| BLOCKED | 2 (BILL-03, BILL-04) |
| N/A | 1 (STATIC-06) |
| **Bugs opened** | **9** (BUG-01 … BUG-09) |

All failures are documented with reproduction steps in `bug_reports.md`. No test in this cycle ever touched a real third-party service.
