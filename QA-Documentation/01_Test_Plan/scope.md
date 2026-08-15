# Test Scope — TaskMind

**Date:** 2026-08-15

---

## 1. In Scope

### 1.1 Functional (API + pages)
| Area | Endpoints / Pages |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout`, `verify`, `resend-verification`, `forgot-password`, `reset-password`; `GET /api/auth/me`; `/auth/*` pages |
| Analysis | `POST /api/analyze/stream` (SSE), `POST /api/analyze/batch`, `POST /api/summarize`, `POST /api/translate`, `POST /api/reply/stream` (SSE) |
| Conversion | `POST /api/convert` (txt→pdf/docx, MIME/type rejection, empty file, timeout) |
| Inbox | `GET /api/inbox`, `/api/inbox/forward`, `/api/inbox/context`, `POST /api/inbox/send`, `/api/mailgun/inbound` (auth path) |
| Reminders & digest | `GET/POST /api/reminders`, `GET/PUT /api/settings/reminders`, `/api/cron/reminders`, `/api/cron/digest` |
| Sync & profile | `GET/PUT/DELETE /api/users/me`, `POST /api/users/me/sync` |
| Share | `POST /api/share`, `GET /share/[id]` (valid, tampered, expired/none) |
| Billing | `GET /api/billing/status`, `/api/billing/checkout`, `/api/billing/portal` (gating; real Stripe blocked) |
| Debug | `/api/debug/health`, `/api/debug/env`, `/api/debug/ai`, `/api/debug/server-action` (guard behavior) |
| Static | `/`, `/actions`, `/history`, `/saved`, `/inbox`, `/settings`, `/dashboard`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/analysis/[id]`, `/share/[id]` |

### 1.2 Security (static + runtime)
- AuthN/AuthZ: session signing/expiry, cookie flags, verification gating, Pro gating on every Pro endpoint.
- Rate limiting: per-route limits, IP attribution, in-memory vs DB-backed buckets.
- Injection: SQLi probes (login/register), XSS via analysis input and share payload.
- IDOR: cross-user reminders/inbox/share scoping.
- CSRF/Origin handling on state-changing routes.
- Crypto: AES-256-GCM share tokens, tamper resistance, token expiry, legacy token fallback.
- Email: arbitrary-recipient sends, Mailgun webhook signature, replay window.
- Info disclosure: error messages, debug endpoints, health endpoint.
- Secrets: `.env` hygiene, hardcoded fallbacks, static-prerendered debug routes.

### 1.3 Performance / build
- `next build` success, static/dynamic route classification, per-route size and First Load JS.
- Cold-start behavior of `summarize` (on-device transformer model).
- Dev-mode-only crash on `/api/convert` (pdfjs-dist bundling).

### 1.4 UI/UX & accessibility (static audit)
- WCAG 2.1 AA: landmarks, headings, labels, focus order/visible focus, contrast, ARIA patterns, keyboard operability, status announcements.
- Responsive: breakpoint layout, mobile bottom nav, touch targets, overflow.
- Client-side security: XSS sinks, `target="_blank"`, metadata, CSP interaction.

### 1.5 Dependencies
- `npm audit --omit=dev`, `npm outdated`, version pinning review.

## 2. Out of Scope

- Real third-party services: Stripe end-to-end, Mailgun delivery, paid OpenRouter/TokenRouter models (never called; env cleared).
- OCR/image PDF conversion accuracy (tesseract/pdfjs exercise only as far as cold-build verification; deep OCR blocked as Pro-only and heavy).
- Load/stress/soak testing, performance under concurrency (single local server; the quota race is documented as static finding only).
- Cross-browser/device testing (static + one curl-based pass only; no browser automation this cycle).
- `src/components/layout/Sidebar.tsx` has a pre-existing uncommitted change — noted, not reviewed as part of this cycle.
- Unit test code review (243 existing tests pass; their quality is out of scope).

## 3. Blocked Items (external dependency)
| Item | Reason | Observed behavior |
|---|---|---|
| Stripe checkout/portal/webhook | No Stripe keys in test env | `/api/billing/portal` → `503 BILLING_UNAVAILABLE` |
| Real email send | Mailgun empty in test env | `/api/inbox/send` → `409 "Email sending isn't configured."` |
| Paid AI analysis | TokenRouter/OpenRouter keys cleared | All analyses fall back to rules engine (`analysisMethod: "fallback"`) |
| Email delivery of verify/reset/reminder/digest | Mailgun empty; dev auto-verifies | Verify/reset flows verified via direct token endpoints and DB |

## 4. Platforms
- **Server**: Linux, Node.js (Next.js 14.2.35), prod `next start` on 127.0.0.1:3000, dev on 127.0.0.1:3001.
- **Client behavior**: inferred from static audit + server-rendered responses; not browser-verified this cycle.
