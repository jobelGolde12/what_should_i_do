# Implementation Plan — Voice Reading + Grounded Analysis Chatbot (+ Backlog)

Ordered, checkable plan for everything in this folder. Each task references
the feature doc and the files it touches. Verification commands are at the
bottom.

Legend: `[ ]` = to do · `[x]` = done. Phases are ordered so that each one
leaves the app in a working state.

---

## Phase 0 — Preparation

- [x] Add OpenCode Zen env vars to `.env.example` (`ZEN_API_KEY`,
      `ZEN_BASE_URL=https://opencode.ai/zen/v1`, `ZEN_MODEL=big-pickle`,
      `ZEN_MODEL_FALLBACKS`, tuning knobs). A live key still needs to be
      obtained from the OpenCode Zen dashboard.
- [x] Baseline `npm run typecheck` / `npm test` / `npm run build` verified
      before touching code.
- [x] 🟡 **Decision D-D4**: chat is **free with a daily quota**
      (`chatMessagesPerDay` — 30/day free, 1000/day Pro); anonymous users are
      IP-rate-limited only. Implemented with `tryIncrement(userId,
      "chat_messages", …)`.

## Phase 1 — Feature 1: Voice reading (translate summary)

> Doc: `01-voice-reading-translate-summary.md`

- [x] **1.1** `src/lib/tts.ts`: `isSpeechSupported`, `getVoices` (with
      `voiceschanged` refresh), `pickVoiceForLang` (incl. `tl`/`fil` alias +
      natural-voice preference), `chunkForSpeech`, `speak` returning a
      cancel/pause/resume handle.
- [x] **1.2** `TranslationBlock.tsx`: Listen/Pause/Resume/Stop controls below
      the translated text; `speechSynthesis.cancel()` on unmount, panel
      collapse, and language switch; sr-only `aria-live` state announcement.
- [x] **1.3** `tests/tts.test.ts` (12 tests): chunking, voice picking,
      support detection.
- [x] **1.4** Typecheck + full test suite pass.

## Phase 2 — Feature 2: Grounded analysis chatbot

> Doc: `02-grounded-analysis-chatbot.md`

### 2a. Provider (OpenCode Zen in the cascade)

- [x] **2.1** `src/lib/ai.ts`: `ProviderName` extended with `"opencodezen"`;
      `OpenCodeZenProvider extends AIProviderBase` (base URL
      `https://opencode.ai/zen/v1`, `ZEN_*` env vars, default model
      `big-pickle`); wired into `providers`, `providerErrors`,
      `configured`, and `getDiagnostics`. The cascade is now TokenRouter →
      OpenRouter → OpenCodeZen, so analysis + reply drafting also get the
      free Zen fallback (backlog A1) automatically.

### 2b. Prompts (grounding)

- [x] **2.3** `src/lib/prompts.ts`: `CHAT_PROMPT_VERSION = "v1"`,
      `CHAT_PRESETS` (5 predefined questions), `CHAT_SYSTEM_PROMPT`
      (grounded-only rules, out-of-scope refusal, treat context as data), and
      `buildChatMessages` which injects the message + serialized analysis as
      delimited data in the system message.

### 2c. Route

- [x] **2.4** `src/app/api/analysis/chat/route.ts` (mirrors
      `reply/stream`): SSE with 10s heartbeat; validates `message`
      (question), `originalMessage`, `analysis`, bounded `history` (last 20);
      `limits.maxMessageChars` → 413; IP/user rate limit → 429; per-user
      daily quota `chat_messages` → 429; `buildChatMessages` →
      `aiClient.streamText(messages, onDelta, { maxTokens: 800 })`; emits
      `text` / `done` / `error`; failures are classified into friendly,
      actionable messages (quota → "out of credits" notice; anything else →
      generic retry copy) — raw provider errors/request ids are never sent to
      the client; `logRequest` metadata-only (zero PII + failure class).

### 2d. Entitlements + client helper

- [x] **2.5** `src/lib/pro/plans.ts`: `chatMessagesPerDay` (free 30, Pro
      1000); `src/lib/pro/usage.ts`: `"chat_messages"` added to `UsageMetric`.
- [x] **2.6** `src/lib/stream.ts`: `streamAnalysisChat` (SSE client, mirrors
      `streamReplyDraft`, supports abort + timeout).

### 2e. UI

- [x] **2.7** `src/components/results/AnalysisChat.tsx`: collapsible panel,
      preset chips, user/accent + assistant/surface-2 bubbles
      (`max-w-[85%]`, `whitespace-pre-line`, `break-words`), streaming with
      Stop, scoped auto-scroll (`scrollIntoView({ block: "nearest" })`),
      error/retry, empty state, per-record reset + abort, Clear button,
      "Answers are based only on this analysis." caption. Responsive (chips
      wrap, `min-w-0` input, 320px pass), on-theme tokens, `aria-live` log
      region, labeled input. Gated off shared/embedded pages via
      `useOptionalTask()` (backlog B2).
- [x] **2.8** `ResultsPanel.tsx`: mounts `<AnalysisChat>` under
      `TranslationBlock` when a record + result exist.
- [x] **2.9** Privacy note added (`src/app/privacy/page.tsx` — "Analysis
      chat") + `.env.example` Zen section.

### 2f. Tests + verify

- [x] **2.10** `tests/analysisChat.test.ts`: prompt assembly (grounded
      system prompt + delimited message/analysis + history + question),
      refusal rules present, SSE streaming, provider-error event, zero-PII
      logging assertion (D3), 400/429 validation.
- [x] **2.11** Full suite (269 tests) + typecheck + lint + build pass.

## Phase 3 — Backlog (🎯 items that ship with the features)

> Doc: `03-additional-features-and-fixes.md`

- [x] **3.1** A1 — OpenCode Zen added to the cascade for analysis + reply
      paths (automatic once the provider is wired in).
- [x] **3.2** B1 — scoped auto-scroll in the chat (no full-page jumps).
- [x] **3.3** B2 — chat hidden on shared/embedded pages (no TaskProvider).
- [x] **3.4** E2 — `README.md` + `enhancement-plan/FEATURES-INDEX.md` updated
      (rows 25 & 26).
- [x] **3.5** D3 — zero-PII chat logging asserted in `tests/analysisChat.test.ts`.
- [x] **Bonus:** `tests/setup-env.ts` now deletes `INBOUND_DOMAIN`, fixing a
      pre-existing environment-dependent inbox-route test failure (the local
      `.env` sets a real Mailgun sandbox domain).

## Phase 4 — Full verification & QA

- [x] **4.1** `npm run typecheck` — clean
- [x] **4.2** `npm test` — 269 passing (incl. new `tts` + `analysisChat`)
- [x] **4.3** `npm run lint` — clean
- [x] **4.4** `npm run build` — production build succeeds
- [x] **4.5** `npm run security:audit` — 0 vulnerabilities
- [ ] **4.6** Browser pass (manual): voice play/pause/stop per language;
      chat chips/streaming/refusal/per-analysis reset; 320px + light/dark;
      keyboard + screen-reader. Requires a running dev server + real AI keys.
- [ ] **4.7** Deferred (external): D1 live-service E2E (Stripe/Mailgun) —
      tracked separately; also obtain a live `ZEN_API_KEY` to exercise the
      real `big-pickle` path end-to-end.

## Definition of done

- [x] Both features work end-to-end in code and pass typecheck/lint/tests/build.
- [x] Chat answers are grounded (out-of-scope refusal verified by test).
- [x] Voice reading works with per-language voices and clean lifecycle.
- [x] Docs in this folder stay accurate; README + feature index updated.
- [ ] Live-browser pass and real-key smoke test (4.6/4.7) remain for the
      implementer with credentials.

---

## Effort summary

| Phase | Tasks | Estimate |
|-------|-------|----------|
| 0 — Prep | 3 | < 1h |
| 1 — Voice reading | 4 | ~0.5 day |
| 2 — Chatbot | 11 | ~2 days |
| 3 — Backlog 🎯 | 5 | ~0.5 day |
| 4 — Verification | 7 | ~0.5 day |

Total implemented: **~3.5 days**, with only the external/manual items
(real Zen key, Stripe/Mailgun E2E, browser pass) outstanding.
