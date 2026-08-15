# Functional Test Cases — TaskMind

**Date:** 2026-08-15
**Result columns filled in** `02_execution_results.md`.

Legend — Priority: **P0** (blocker), **P1** (high), **P2** (normal), **P3** (low). Mode: API (curl) / STATIC (static pages) / SSE (streamed).

---

## A. Auth

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| AUTH-01 | P0 | API | Register valid account | No existing user | `POST /api/auth/register` with valid email+8char password | 201, `requiresVerification:false` in dev (Mailgun unconfigured) |
| AUTH-02 | P0 | API | Register duplicate email | Account exists | Register same email again | 409 "An account with this email already exists." |
| AUTH-03 | P0 | API | Register weak password | — | Register with password < 8 chars | 400 validation error |
| AUTH-04 | P0 | API | Register invalid email | — | Register with malformed email | 400 validation error |
| AUTH-05 | P1 | API | Register malformed JSON | — | Send invalid JSON body | 400 (see BUG-01: returns 500) |
| AUTH-06 | P0 | API | Login wrong password | Account exists | Login with wrong password | 401 |
| AUTH-07 | P0 | API | Login correct | Account exists + verified | Login with correct password | 200 + `taskmind_session` cookie set (HttpOnly, SameSite=Lax) |
| AUTH-08 | P1 | API | Session `me` with cookie | Logged in | `GET /api/auth/me` with cookie | 200 user object |
| AUTH-09 | P0 | API | Session `me` without cookie | Fresh | `GET /api/auth/me` no cookie | 401 `{"user":null}` |
| AUTH-10 | P0 | API | Logout | Logged in | `POST /api/auth/logout` | 200, cookie cleared, subsequent `me` → 401 |
| AUTH-11 | P1 | API | Forgot password generic | — | `POST /api/auth/forgot-password` for existing + non-existing email | Same generic message both cases (anti-enumeration) |
| AUTH-12 | P1 | API | Resend verification | Registered unverified | `POST /api/auth/resend-verification` | Generic success message, no account enumeration |
| AUTH-13 | P1 | API | Register in prod w/o Mailgun | Prod server, Mailgun empty | Register valid account | **503 "Registration is temporarily unavailable."** but user row is created (see BUG-03) |
| AUTH-14 | P0 | API | Login rate limit | Fresh IP window | 11 rapid wrong-password logins | 401 × 10 then 429 |
| AUTH-15 | P1 | API | SQLi probe on login | — | Login with `email` containing `OR 1=1` / `; DROP TABLE` | 400/401/429, never 500 or auth bypass |

## B. Analysis

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| ANA-01 | P0 | SSE | Stream analyze, free plan | Fresh IP, no auth | `POST /api/analyze/stream` valid text | SSE `data:` events ending in `done`, `analysisMethod:"fallback"` |
| ANA-02 | P0 | API | Stream analyze with `deep:true` free | No auth | Same with `{"deep":true}` | 403 `PRO_REQUIRED` |
| ANA-03 | P1 | API | Stream analyze empty input | — | Empty/whitespace text | 400 |
| ANA-04 | P1 | SSE | Stream analyze too-short input | — | Text below min length | SSE error event (non-2xx content in stream) |
| ANA-05 | P1 | API | Stream analyze rate limit (anon) | Fresh window | 16 rapid anonymous calls | 200 × 15 then 429 (`rateLimit(ip, 15)`) |
| ANA-06 | P1 | API | Batch analyze, free | Free user | `POST /api/analyze/batch` | 403 `PRO_REQUIRED` (Pro-only feature) |
| ANA-07 | P1 | API | Batch analyze, Pro | Pro user | Same | 200 with batch results (rules fallback) |
| ANA-08 | P2 | SSE | Reply/stream, no session | Fresh | `POST /api/reply/stream` no cookie | 403 (inconsistent with other Pro routes' 401 — see BUG-02) |
| ANA-09 | P2 | SSE | Reply/stream Pro, empty message | Pro | Body with empty `message` | Error "Message is empty." |
| ANA-10 | P2 | SSE | Reply/stream Pro, valid | Pro | `message` + `tone` | SSE `done` event with draft text (rules fallback) |
| ANA-11 | P1 | API | Summarize cold start | Fresh server, model not loaded | `POST /api/summarize` | First call exceeds 30s (model load/download); returns 200 + summary on retry (`cached:true`) — see BUG-06 |
| ANA-12 | P2 | API | Translate | — | `POST /api/translate` "Hola mi amigo" → en | 200 with English translation |
| ANA-13 | P1 | API | XSS probe through analysis | — | Input containing `<script>alert(1)</script>` | Output is data (rules), never rendered as HTML (front-end escapes); see a11y/security notes |

## C. Conversion

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| CONV-01 | P1 | API | Convert txt→pdf | Pro, prod server | `POST /api/convert` with text file, `to=pdf` | 200, `application/pdf`, valid PDF body |
| CONV-02 | P1 | API | Convert txt→docx | Pro | Same, `to=docx` | 200 with document output |
| CONV-03 | P1 | API | Convert missing file | Pro | POST with no file | 400 |
| CONV-04 | P1 | API | Convert bad target format | Pro | `to=xyz` | 400/413 validation |
| CONV-05 | P1 | API | Convert empty file | Pro | Empty file | 400 (server-side `file.size === 0`) |
| CONV-06 | P2 | API | Convert dev-mode | Dev server | Any convert call | **Crash at module load, 500** — see BUG-05 |
| CONV-07 | P2 | API | Convert size cap | Pro | File > max | 413-style error (server re-validates `file.size`) |
| CONV-08 | P1 | API | Convert unauthenticated | — | No cookie | 401 |

## D. Inbox & Reminders

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| INB-01 | P0 | API | Inbox list (Pro) | Pro session | `GET /api/inbox` | 200 `[]` (fresh account) |
| INB-02 | P0 | API | Inbox unauthenticated | Fresh | `GET /api/inbox` | 401 |
| INB-03 | P1 | API | Forward address | Pro | `GET /api/inbox/forward` | 200 with `in.taskmind.app` address |
| INB-04 | P1 | API | Send reply unconfigured | Pro, Mailgun empty | `POST /api/inbox/send` | 409 "Email sending isn't configured." |
| INB-05 | P1 | API | Context missing analysisId | Pro | `GET /api/inbox/context` no param | 400 |
| REM-01 | P0 | API | Reminders GET unauthenticated | Fresh | `GET /api/reminders` | 401 |
| REM-02 | P0 | API | Reminders GET missing analysisId | Pro | GET no `analysisId` | 400 |
| REM-03 | P0 | API | Reminders POST create | Pro | POST `{analysisId, deadlines:[...], presetKey}` | 200 `{ok:true, created:1, plan:{...}}` |
| REM-04 | P0 | API | Reminders GET after create | Pro | GET with analysisId | 200 with plan + reminders |
| REM-05 | P1 | API | Reminders cross-user isolation | ua + ub Pro | ub reads ua's analysisId | 200 but empty plan (scoped by userId) |
| REM-06 | P2 | API | Cron reminders auth | Fresh | `POST /api/cron/reminders` | 401 without `CRON_SECRET` |
| REM-07 | P2 | API | Cron reminders dry-run | CRON_SECRET | With `Authorization: Bearer qa-cron-secret` + `?dry=1` | 200 `{ok:true, dry:true, due:0...}` |
| REM-08 | P2 | API | Cron digest dry-run | CRON_SECRET | Same pattern | 200 `{ok:true, dry:true, users:1, sent:0}` |
| REM-09 | P2 | API | Settings reminders defaults | Pro | `GET /api/settings/reminders` | 200 with default digest settings |

## E. Sync & Profile

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| SYNC-01 | P0 | API | Profile GET (me) | Pro | `GET /api/users/me` | 200 with user + data |
| SYNC-02 | P1 | API | Profile PUT rename | Pro | `PUT /api/users/me` with new name | 200, name persisted |
| SYNC-03 | P1 | API | Profile DELETE | Pro | `DELETE /api/users/me` | 200 `{ok:true}`, user removed from DB |
| SYNC-04 | P1 | API | Sync endpoint | Pro | `POST /api/users/me/sync` | 200 with patched data |

## F. Sharing

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| SHARE-01 | P0 | API | Create share | Pro | `POST /api/share` valid payload | 200 `{link: "…/share/enc:..."}` (AES-256-GCM) |
| SHARE-02 | P1 | API | Create share invalid payload | — | Missing/invalid fields (bad urgency, analysisMethod) | 400 "Invalid share payload." |
| SHARE-03 | P1 | API | Create share future timestamp | Pro | `timestamp = now + 24h` | 200 — timestamp not freshness-validated (see BUG-07) |
| SHARE-04 | P0 | STATIC | Share page anonymous | Valid token | `GET /share/<token>` no cookie | 200 renders analysis |
| SHARE-05 | P1 | STATIC | Share page tampered token | — | `GET /share/enc:garbage` | Page returns **HTTP 200** rendering title "Shared analysis - TaskMind" with "404" content — see BUG-04 |

## G. Billing & Pro Gating

| ID | Priority | Mode | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| BILL-01 | P0 | API | Pro routes unauthenticated | Fresh | inbox/reminders/sync/batch GET | 401 (batch/reply → 403, see BUG-02) |
| BILL-02 | P1 | API | Billing status | Pro | `GET /api/billing/status` | 200 (plan read from DB) |
| BILL-03 | P2 | API | Billing portal blocked | Any | `POST /api/billing/portal` | 503 `BILLING_UNAVAILABLE` (Stripe unconfigured) |
| BILL-04 | P2 | API | Billing checkout blocked | Any | `POST /api/billing/checkout` | 503 (blocked; real Stripe out of scope) |
| BILL-05 | P2 | API | Debug endpoints prod | Prod | `GET /api/debug/health` | 200 (unauthenticated info) |
| BILL-06 | P2 | API | Debug env prod w/ ADMIN_TOKEN | Prod | `GET /api/debug/env` | **404 "disabled in production"** — static prerender defeats runtime guard (see BUG-08) |

## H. Static Pages & Metadata

| ID | Priority | Mode | Title | Steps | Expected |
|---|---|---|---|---|---|
| STATIC-01 | P2 | STATIC | Landing + legal pages | GET `/`, `/privacy`, `/terms` | 200 |
| STATIC-02 | P2 | STATIC | Workspace pages | GET `/actions`, `/history`, `/saved`, `/inbox`, `/settings`, `/dashboard` | 200 |
| STATIC-03 | P2 | STATIC | Auth pages | GET `/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify` | 200 |
| STATIC-04 | P2 | STATIC | Wrong login path | GET `/login` | 404 (auth pages live under `/auth/*`) |
| STATIC-05 | P2 | STATIC | SEO files | GET `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` | 200 with expected content types |
| STATIC-06 | P3 | STATIC | Analysis page shape | GET `/analysis/<id>` | 200 (dynamic) |
