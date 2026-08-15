# Runtime Performance & Bottlenecks — TaskMind

**Date:** 2026-08-15
**Method:** Production server (`next start`) on localhost; single-process observations. No load testing this cycle (documented as out of scope).

---

## 1. Bottlenecks observed

### RT-01 — Summarize cold start exceeds 30 s (confirmed)
- **Endpoint:** `POST /api/summarize`
- **Observation:** On a fresh process, the first request returned no body within 30 s (model `distilbart-cnn-12-6` loaded/downloaded via `@xenova/transformers` on demand from HuggingFace). Subsequent requests returned 200 with the summary and `cached:true` in normal latency.
- **Impact:** First summarization per process/instance times out typical clients (and appears as a failure). On serverless/auto-scaling this is paid on every cold worker.
- **Recommendation:** Pre-warm on boot, run summarization as a queued/lazy background job with a status endpoint, or set an explicit model-load phase that returns `202/loading`.

### RT-02 — Dev-mode `/api/convert` crashes at module load (dev-only)
- **Endpoint:** `POST /api/convert` under `next dev`
- **Observation:** `TypeError: Object.defineProperty called on non-object` at module evaluation of `pdfjs-dist/legacy/build/pdf.mjs` (`src/lib/convert/index.ts:14`). Production build is unaffected. See BUG-05.
- **Impact:** Development throughput only; blocks manual testing of the whole convert pipeline during development.

### RT-03 — AI fallback path adds latency and leaks prompt text
- **Observation:** With providers unavailable, `/api/analyze/*` and `/api/reply/stream` wait out the provider attempt (timeouts/circuit breaker) before falling back to the rules engine. Fallback output quality degrades (prompt text leaked into results — BUG-09).
- **Impact:** Users in degraded state see both latency and garbled output. Consider a fast-fail when the provider is known down (circuit breaker is present but the fallback still runs).

### RT-04 — Convert has a fixed 30 s timeout
- **Location:** `src/app/api/convert/route.ts:132` — rejects with "Conversion timed out. Try a smaller file."
- **Observation:** Appropriate guard, but combined with large documents (esp. OCR/image PDFs) it means large-but-valid jobs simply fail. Not a defect; a sizing/pricing consideration.

### RT-05 — Rate limiting can throttle legit users (shared bucket)
- **Observation:** With `TRUST_PROXY` unset, all traffic collapses to one `"unknown"` bucket (SEC-05). Confirmed at runtime: 15 anonymous analyze calls then 429. A single noisy client (or the monitoring itself) can exhaust the shared quota for everyone.
- **Impact:** Availability risk in any deployment without a proper trusted-proxy setup; adds support incidents.

## 2. Availability-related runtime behavior

| Area | Behavior | Note |
|---|---|---|
| `rateLimitDb` fail-closed | DB errors → auth requests rejected (429/500) | Security-correct, availability-costly (SEC-20) |
| Billing unavailable | `503 BILLING_UNAVAILABLE` when Stripe unconfigured | Feature-detect; no half-applied state |
| Cron reminders retry | Reminder marks `sent` only on Mailgun success | No email loss on transient errors |
| Share encryption failure | 500 only on crypto failure; payload validation is 400 | Correct status separation |
| Static pages | All prerendered; no runtime DB hit on landing/legal | Good |

## 3. First-load budgets (see build_analysis.md)
- Landing `/` = 146 kB First Load JS — over the ~100 kB soft budget.
- Shared shell = 87.7 kB.
- Analysis/share pages ≈ 136–140 kB.
- Recommendations: code-split the ad rail / analytics / framer-motion from critical path; lazy-load heavy views.

## 4. Items requiring load testing (deferred, not run)
- Concurrent quota race (SEC-19) at the daily boundary.
- `rateLimitDb` behavior under real Turso latency (429 storms).
- Streaming under many concurrent SSE clients (analyze/stream, reply/stream).
- OCR/image-PDF convert throughput and memory.
- Summarize under concurrent first-requests (model load locking — transformers has no obvious singleflight guard).
