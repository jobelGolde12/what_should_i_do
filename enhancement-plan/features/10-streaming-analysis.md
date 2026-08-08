# Feature 10 — Streaming Analysis

> **Status: DONE** — `streamAnalysis` now accepts an external `AbortSignal` and a client-side timeout (default 120s), surfacing both as `StreamCancelledError` (so cancel isn't mistaken for a provider failure and doesn't trigger the rule fallback). The SSE route emits a 10s heartbeat (`{"type":"ping"}`) to keep proxies alive. `DashboardHome` wires an `AbortController` with a "Cancel" button shown in the ResultsPanel header while streaming.

## 1. What it is & its role

The **Streaming Analysis** feature progressively reveals analysis sections (Actions → Deadlines → Urgency → Unclear → Next Step → Summary) as the LLM generates them, instead of making users wait for the full response. It uses **Server-Sent Events (SSE)** and a "settling" animation to deliver a fast, engaging result experience.

## 2. Current functionality

### Where it lives
- **SSE endpoint:** `src/app/api/analyze/stream/route.ts` (Node runtime, `force-dynamic`).
- **Client consumer:** `src/lib/stream.ts` → `streamAnalysis()`.
- **Progressive parser:** `src/lib/streamParse.ts` → `extractCompletedFields()`, `STREAM_FIELD_ORDER`.
- **UI:** `DashboardHome.tsx` (drives streaming state) + `ResultsPanel.tsx` (renders partial fields + "settling").
- **Fallback:** streaming route falls back to `runRuleAnalysis()` when OpenRouter fails.

### How it works today
1. `DashboardHome` calls `streamAnalysis(text, onField)`.
2. Client POSTs to `/api/analyze/stream`.
3. The route calls `openRouterAPI.streamRaw()`, which accumulates JSON deltas.
4. `extractCompletedFields()` detects top-level fields whose full JSON value is present and emits `{ type: "field", field, value }` SSE events.
5. `onField` updates the partial result; `ResultsPanel` reveals each completed section.
6. When streaming finishes, a `done` event delivers the final authoritative result; `saveAnalysis` persists it.
7. On any failure, the route falls back to rule-based analysis and emits `done` with `streamed: false`.

### Current limitations
- **No client-side timeout / abort** — a stalled stream leaves the spinner running.
- **No reconnection** — one error ends the stream and forces the fallback.
- **No heartbeat** — proxies may time out idle SSE connections.
- **Buffer/backpressure** not explicitly handled for very large outputs.
- The `streamParse` heuristic can miss fields if the model emits them out of order or wraps content.
- No visible progress percentage or remaining sections.
- No cancellation UI (user can't stop a running analysis).

## 3. Future enhancements (production-ready Streaming Analysis)

### 3.1 Robust streaming client
- Add **timeout** and **AbortController** support; allow user **cancel**.
- Add **reconnect/retry** for dropped connections (with a max attempt count).
- Emit/model **heartbeats** (`data: {"type":"ping"}`) to keep connections alive.

### 3.2 Reliable field parsing
- If field-order parsing fails, fall back to parsing the full JSON once done (already done) and reveal all sections together.
- Add periodic re-scan with a debounce to catch fields that complete mid-buffer.

### 3.3 Progress UX
- Show a progress state (e.g., "3 of 6 sections") and skeleton placeholders for unrevealed sections.
- Add a cancel button and an estimated-time indicator.

### 3.4 Backpressure & limits
- Cap output length and add a max duration.
- Handle backpressure from the client reader.

### 3.5 Testing
- Integration tests for the SSE endpoint with a mocked stream source.
- Unit tests for `extractCompletedFields` with partial/streamed JSON fixtures.
- E2E test for the full streaming flow.

> **Definition of "done" for this feature:** Streaming is cancellable, timeout-safe, reconnecting, heartbeat-backed, shows progress, parses fields reliably, and is covered by integration/E2E tests.
