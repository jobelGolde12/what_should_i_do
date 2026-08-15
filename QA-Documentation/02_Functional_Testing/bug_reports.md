# Bug Reports — TaskMind

**Date:** 2026-08-15
**Severity guide:** Critical (data loss/security), High (feature broken / significant defect), Medium (partial defect / UX), Low (polish).
Reproduction was done against the isolated QA environment (local DB, empty third-party creds). File references point at the code responsible.

---

## BUG-01 — Register returns 500 on malformed JSON instead of 400
- **Severity:** Medium
- **Area:** `POST /api/auth/register`
- **Reproduction:**
  1. `curl -X POST /api/auth/register -H "Content-Type: application/json -d 'not json'`
- **Actual:** HTTP 500 `{"error":"Something went wrong. Try again."}`
- **Expected:** HTTP 400 validation error.
- **Why:** The route parses the body inside a `try/catch` whose catch produces a generic 500; a JSON parse error is not discriminated from an unexpected server error. Client-side, this surfaces a misleading "something went wrong" to a user who merely mis-typed a form field.
- **Related code:** `src/app/api/auth/register/route.ts:40-72` (and same pattern in sibling auth routes).

## BUG-02 — Inconsistent auth responses across Pro-gated routes (401 vs 403)
- **Severity:** Low
- **Area:** Pro-gated API routes
- **Reproduction:**
  1. No session. `GET /api/inbox`, `GET /api/reminders`, `GET /api/users/me/sync`, `POST /api/analyze/batch` → **401**.
  2. No session. `POST /api/reply/stream` → **403**.
- **Actual:** Mixed 401 (not signed in) and 403 (forbidden) for the same "unauthenticated" condition.
- **Expected:** Consistent status semantics (unauthenticated ⇒ 401).
- **Impact:** Client error handling and monitoring heuristics are unreliable; minor.

## BUG-03 — Registration in production without Mailgun creates orphan accounts then 503s
- **Severity:** Medium
- **Area:** `POST /api/auth/register` in production with Mailgun unconfigured
- **Reproduction:**
  1. Start prod server with empty Mailgun creds.
  2. Register a new account.
- **Actual:** HTTP 503 "Registration is temporarily unavailable." — **but** the user row is already written (`createUser` runs before the Mailgun check). Verified: retry returns 409 "account already exists"; DB shows 3 such orphan rows created during testing.
- **Expected:** Either reject before creating the row, or create it as pending-verification and not abandon it.
- **Impact:** Account rows accumulate with no verification path and no cleanup; a later legit registration by the same email is blocked by a 409.
- **Related code:** `src/app/api/auth/register/route.ts:63` (`createUser`) precedes the Mailgun check at `:68-74`.

## BUG-04 — Tampered share token returns HTTP 200 with a "404" page
- **Severity:** Low
- **Area:** `GET /share/[id]` (client-side not-found handling)
- **Reproduction:**
  1. `GET /share/enc:garbage-token-here`
- **Actual:** HTTP 200, HTML `<title>Shared analysis - TaskMind</title>` with "404" content rendered in-body.
- **Expected:** HTTP 404 with a proper not-found page.
- **Impact:** SEO/crawler confusion (noindex is set), and clients cannot distinguish a missing share from a valid one by status code. Incorrect status for an authenticated-tamper rejection.
- **Related code:** `src/app/share/[id]/page.tsx` (notFound is thrown client-side; route handler doesn't set the response status).

## BUG-05 — Dev-mode `/api/convert` crashes with 500 at module load (pdfjs-dist bundling)
- **Severity:** High (development workflow only; production unaffected)
- **Area:** `POST /api/convert` in `next dev`
- **Reproduction:**
  1. `npm run dev`
  2. `POST /api/convert`
- **Actual:** HTTP 500; server log: `TypeError: Object.defineProperty called on non-object` thrown at module evaluation of `pdfjs-dist/legacy/build/pdf.mjs` imported by `src/lib/convert/index.ts:14`.
- **Expected:** Conversion works in dev as it does in production.
- **Impact:** All conversion functionality is unusable during development (a debug/QA regression only). Root cause is RSC/webpack bundling of the pdfjs legacy build in dev; a webpack external/config workaround is required.
- **Related code:** `src/lib/convert/index.ts:14`.

## BUG-06 — Summarize cold start exceeds 30s (first request effectively times out)
- **Severity:** Medium
- **Area:** `POST /api/summarize` (on-device `@xenova/transformers`, distilbart-cnn-12-6)
- **Reproduction:**
  1. Fresh server process.
  2. `POST /api/summarize` with text, client timeout 30s.
- **Actual:** First request returns empty within 30s (model download/load from HuggingFace hub). Second request (model warm) returns 200 with summary and `cached:true` within normal latency.
- **Expected:** Either a bounded load with a clear in-progress/error signal, or a pre-warm / async strategy. 30s+ cold start will time out typical clients and shows as a failure.
- **Impact:** First summarize per process is unreliable; on cold deployments every user pays this cost.

## BUG-07 — Share links never expire and `timestamp` is not freshness-validated
- **Severity:** Medium (privacy)
- **Area:** `POST /api/share`, `src/lib/share-crypto.ts`
- **Reproduction:**
  1. Create a share with `timestamp = now + 24h` (and any age in the past).
  2. Token is created successfully; decryption (`decryptShareToken`) never checks age.
- **Actual:** `validatePayload` only requires `timestamp` to be a finite number; no freshness window and no expiry on decrypt.
- **Expected:** A token TTL (e.g. reject tokens older than N days) and a bounded acceptable future-skew.
- **Impact:** A leaked share token is valid forever (until `SHARE_SECRET` rotation, which breaks all shares globally). For a "sensitive" share this is a lasting privacy exposure.
- **Related code:** `src/app/api/share/route.ts:30-31`, `src/lib/share-crypto.ts` `decryptShareToken`.

## BUG-08 — `/api/debug/env` and `/api/debug/health` are statically prerendered; env is permanently disabled in production
- **Severity:** Low (defense-in-depth note)
- **Area:** Debug endpoints
- **Reproduction:**
  1. Build with `ADMIN_TOKEN` set at runtime (`next start`), `NODE_ENV=production`.
  2. `GET /api/debug/env` → 404 "Debug endpoints are disabled in production."
  3. `GET /api/debug/health` twice → byte-identical response (same `uptime`/`timestamp`) — stale.
- **Actual:** Build output shows `○ /api/debug/env` and `○ /api/debug/health` (static). The route handlers ran at **build time**, when `ADMIN_TOKEN` was unset, so the env guard result and health payload were baked in. `debug/env` can never be enabled in a production build even with the token configured; `debug/health` serves build-time state (it also leaks AI provider/model/version unauthenticated).
- **Expected:** Debug endpoints should be dynamic (`force-dynamic`) or removed from production builds.
- **Impact:** Info disclosure is limited (masked values) and the endpoints are effectively dead in prod; still, the intent of the `ADMIN_TOKEN` guard is defeated by static caching, and health monitoring gets stale data.
- **Related code:** `src/lib/debug/guard.ts`, `src/app/api/debug/env/route.ts`, `src/app/api/debug/health/route.ts`.

## BUG-09 — Rules-fallback analysis output contains prompt-leakage artifacts
- **Severity:** Low (quality)
- **Area:** `POST /api/analyze/batch` / `POST /api/analyze/stream` when the AI provider is unavailable
- **Reproduction:**
  1. With AI keys unavailable, analyze "Please submit the report by monday".
- **Actual:** Rule output concatenates the instruction text into action text, e.g. action "Submit the report by monday (Please analyze this brief message for any actions" and the summary embeds the original input verbatim then repeats it.
- **Expected:** The fallback output should never echo the system-prompt instruction phrase, and the summary should not duplicate the raw input.
- **Impact:** In a degraded state, users see garbled/duplicated text and leaked prompt wording — a quality and trust issue for the fallback path.
- **Related code:** `src/lib/analyzeRules.ts`, `src/lib/replyFallback.ts` (input echo into output fields).

---

## Not bugs, noted behavior
- **Register in prod without Mailgun → 503** is intentional (production requires email verification), but the orphan-row side effect (BUG-03) is the defect.
- **`/login` → 404**: correct; auth pages are under `/auth/*`.
- **`/api/inbox/send` → 409** with Mailgun unconfigured: correct feature-detection behavior.
- **`/api/debug/health` unauthenticated**: intentional for uptime monitors (flagged in security audit as info disclosure).
