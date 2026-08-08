# Feature 22 — Standalone Summarize API (offline model)

## 1. What it is & its role

The **Standalone Summarize API** is an edge route that runs a local, quantized summarization model (`Xenova/distilbart-cnn-12-6`) via `@xenova/transformers` to summarize text without calling an external LLM. Its role is a lighter-weight, offline-capable summarization option.

## 2. Current functionality

### Where it lives
- **Route:** `src/app/api/summarize/route.ts` (Edge runtime).
- **Package:** `@xenova/transformers` (dependency).
- **Types:** `types/node-summarizer.d.ts` (legacy `node-summarizer` types).

### How it works today
1. POST with `{ text, max_length?, min_length? }`.
2. Validates text ≥ 20 chars.
3. Loads the summarization pipeline once and caches it in a module-level variable.
4. Runs the model with clamped length params, extracts `summary_text`, and returns `{ summary, model }`.

### Current limitations
- **Not used by the main app** — the app's summary comes from the OpenRouter analysis (Feature 06); this route is effectively orphaned.
- **Edge runtime + heavy model** typically fails to load a ~hundreds-of-MB model in a serverless edge/Vercel environment; not reliable.
- Module-level cache is not guaranteed to persist across serverless instances.
- No token/rate limits; any caller can consume compute.
- No auth; publicly reachable.
- Legacy `node-summarizer` types/Dependency linger unused.
- No fallback if the model fails to load.

## 3. Future enhancements (production-ready Summarize API)

### 3.1 Decide the role of this feature
- **Option A (recommended):** Remove/retire the orphaned route and the unused `node-summarizer` dependency to reduce bundle/surface area, OR
- **Option B:** Adopt it as a **free offline fallback** for summary generation when OpenRouter is down, but run it in a **Node runtime** (not edge) and warm it up intentionally.

### 3.2 If kept, harden it
- Move to **Node runtime**; add a warm-up job and model persistence.
- Add **auth/rate limiting** and request size limits.
- Add graceful fallback (return a rule-based summary if the model fails).
- Cache summaries by text hash.

### 3.3 Remove dead code
- Delete unused `types/node-summarizer.d.ts` and the `node-summarizer` dependency if not used.

### 3.4 Testing
- Integration test with a minimal model or a mocked pipeline.
- Test for validation, clamps, and error paths.

> **Status: DONE** — Kept as a hardened offline summarize API (Option B). Rewrote `src/app/api/summarize/route.ts`: moved from edge to **Node runtime**; added module-level text-hash summary cache (cap 200); graceful **extractive fallback** (first 2-3 sentences) when the model fails to load; request size limit (≤20k chars → 413); safe clamping of `max_length`/`min_length`; `cached` flag in responses; robust JSON parsing. Made it actually run: `next.config.js` now marks `@xenova/transformers`/`onnxruntime-node` as `serverComponentsExternalPackages` + webpack externals so the native `onnxruntime_binding.node` binary isn't bundled (was crashing the dev server). **Removed dead code**: deleted `node-summarizer` dependency and `types/node-summarizer.d.ts`. Verified live: real `distilbart-cnn-12-6` summary (200, 130s first load), cache hit in 42ms, 400 on short/invalid body, 413 on oversized text. Not yet wired into the app UI as an offline fallback — that remains a future enhancement (the app's summary still comes from OpenRouter analysis, Feature 06).

> **Definition of "done" for this feature:** The summarize route is either cleanly removed or made production-reliable (correct runtime, limits, fallback, caching), and dead dependencies are removed.
