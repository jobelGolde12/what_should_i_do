# Feature 24 — Privacy & Security Model — ✅ DONE

> Implemented. See `docs/security.md` for the full checklist and `features/23`
> for the design pass that removed model-output XSS.

## 2.1 Implementation summary

- **Legal pages**: `/privacy` and `/terms` (static, indexable, DashboardLayout).
- **Transparency**: `SiteFooter` (Privacy/Terms links) added to DashboardLayout,
  AuthForm, and ShareView; data-handling notice + Privacy link under the Analyze
  button in `InputArea`.
- **Rate limiting**: shared `src/lib/rateLimit.ts` (per-process fixed window,
  per-IP). `/api/analyze/stream` 15/min + 20k chars (413), `/api/summarize`
  10/min, `/api/translate` 30/min, `/api/auth/login|register` 10/min (429).
- **Logging**: `src/lib/log.ts` structured logs (requestId, endpoint, chars,
  latency) — analyzed text never logged; stream route logs start/finish.
- **Settings wording**: "nothing is uploaded beyond the text you analyze (and,
  if you sign in, whatever you choose to sync)".
- **Scripts**: `security:audit` (npm audit --omit=dev) and `typecheck`.
- **Doc**: `docs/security.md` — endpoint inventory, hardened-status checklist,
  known risks (Next 14→15, transformers chain, underscore, share-link expiry),
  key rotation/least privilege.
- **Also fixed**: duplicated `<title>` on every page (page set `X - TaskMind`
  while the root `title.template` already appended `- TaskMind`).

## 1. What it is & its role

The **Privacy & Security Model** defines how user data is handled and protected. TaskMind is **local-first**: history, board, templates, and settings are stored in the browser's `localStorage`, while only the text to be analyzed is sent to a server-side LLM (OpenRouter). Its role is to protect user data and be transparent about trust.

## 2. Current functionality

### Where it lives
- **Local storage:** `src/lib/storage.ts` (history, templates, board, theme).
- **Server transmission:** text sent to `/api/analyze/stream` and the `analyzeText` server action → OpenRouter.
- **Share:** `src/lib/share.ts` (base64-encoded payload embedded in URL).
- **Settings note:** `SettingsView.tsx` states "Everything is stored locally in your browser — nothing is uploaded beyond the text you analyze."

### How it works today
1. All app data (history, board, templates, theme) is stored locally in `localStorage`.
2. Only the input text is sent to the server for analysis (OpenRouter call).
3. No cookies/sessions currently (no auth).
4. Share links encode the full analysis (including raw input) into the URL.

### Current limitations
- **No explicit privacy policy / terms** document linked in the app.
- **No consent** for data processing or ads (AdSense requires consent for EEA).
- **No encryption at rest** for localStorage (anyone with device access can read it).
- **Server transmission to OpenRouter** is not disclosed clearly to users at the point of submission.
- **Share links expose raw input** to anyone with the link (no expiry/password — see Feature 15).
- **No rate limiting** on API endpoints (`/api/analyze/stream`, `/api/summarize`, debug routes) — abuse/DoS and cost risk.
- **XSS risk:** the summary is rendered via `dangerouslySetInnerHTML` from model output (see Feature 06).
- **No dependency/security scanning** configured in CI.
- **No audit logging** of data access.
- Environment/key handling: API keys are server-only (good), but no secrets rotation policy.

## 3. Future enhancements (production-ready Privacy & Security Model)

### 3.1 Legal & transparency
- Add **Privacy Policy** and **Terms of Service** pages, linked from the footer/layout.
- Add a **data-handling notice** at the point of analysis ("Sending text to AI; see privacy policy").
- Add **consent management** for ads (CCA/TCF) and analytics.

### 3.2 Secure data handling
- Sanitize ALL model output before rendering (remove `dangerouslySetInnerHTML` or use DOMPurify).
- Optionally encrypt sensitive local data (via WebCrypto with a user passphrase) — or clearly document local-only limits.
- Add **expiry/password** to share links and a "don't include raw input" option.

### 3.3 API hardening
- Add **rate limiting** and **input size limits** on all public endpoints.
- **Disable debug routes in production** (see Feature 21).
- Add **grounding/validation** so LLM output conforms to schema (zod).

### 3.4 CI/CD security
- Add **dependency vulnerability scanning** (e.g., `npm audit`, Snyk/Dependabot).
- Add **secret scanning** and linting for security issues (eslint-plugin-security).
- Enforce **least-privilege env** handling and document key rotation.

### 3.5 Observability & audit
- Structured logging with request IDs; optional audit trail for data access.
- Error tracking (Sentry) without logging sensitive text.

### 3.6 User data rights
- When auth is added (Feature 19): support **export, delete, and erasure** of all user data.

### 3.7 Testing
- Security tests: XSS injection, rate limiting, endpoint gating, secret handling.
- A privacy/security checklist in the repo.

> **Definition of "done" for this feature:** Transparent privacy policy/consent, sanitized output, hardened public endpoints, CI security scanning, rate limiting, secret governance, and user data rights — all documented and tested.
