# Additional Features & Fixes to Fold Into This Effort

Curated backlog of other work that fits naturally alongside the voice-reading
and analysis-chatbot features. Each item is grounded in the current codebase
with a rough effort estimate. Items marked 🎯 are directly enabled by the two
feature docs and should ship with them.

---

## A. AI / Provider

| # | Item | What / Why | Where | Effort |
|---|------|------------|-------|--------|
| A1 🎯 | **OpenCode Zen fallback for all AI paths** | Once `OpenCodeZenProvider` lands for chat, add `big-pickle`/`deepseek-v4-flash-free` to the cascade for analysis + reply drafting too — free capacity reduces TokenRouter/OpenRouter spend and adds resilience | `src/lib/ai.ts` (constructor model lists), `.env.example` | S |
| A2 | **Provider attribution in results UI** | Show which provider/model produced an analysis (usage is already tracked in `AIUsage`); today only `aiProviderUsed` ("tokenrouter" | "openrouter") is surfaced as a badge | `src/components/results/ResultsPanel.tsx`, `Badge` | S |
| A3 🎯 | **Chat quota wiring** | Add `chatMessagesPerDay` to `UserLimits` and the `chat_messages` usage key so the chat route can enforce daily limits (currently only `analyses`, `translations`, `reply_drafts` exist) | `src/lib/pro/entitlements.ts`, `src/lib/pro/usage.ts` | S |
| A4 | **Eval coverage for the grounded chat** | Add a scripted eval (extend `scripts/eval.ts`) that verifies out-of-scope refusal and grounding fidelity for `big-pickle` | `scripts/`, `evaluation/` | M |

## B. UX / UI

| # | Item | What / Why | Where | Effort |
|---|------|------------|-------|--------|
| B1 🎯 | **Fix streaming auto-scroll jump** | Known issue: `scrollIntoView` during streaming jumps the whole page. Scope scroll to the chat/list container (`block: "nearest"` on a sentinel) and fix the same pattern in the analysis streaming view | `AnalysisChat`, streaming results view | S |
| B2 🎯 | **Gate chat on shared/embedded pages** | Shared pages (`src/app/share/[id]`) render `ResultsPanel`; the chat must not appear for anonymous visitors (mirrors ReplyPanel's Pro gate). Verify the gate uses the same "has user" signal as `ReplyPanel` | `ResultsPanel`, `AnalysisChat` props | S |
| B3 | **Voice availability hint** | When a language has no matching OS voice, show a one-time hint (see Feature 1). Optionally allow a settings default rate/pitch | `TranslationBlock`, `SettingsView` | S |
| B4 | **Chat message copy button** | Copy an assistant answer to clipboard (reuse `copyText` from `src/lib/share.ts` + toast) — high-value for share-back workflows | `AnalysisChat` | S |
| B5 | **320px pass on BottomNav / actions board** | Original QA list: verify bottom-nav touch targets and `ActionsBoard` touch drag-and-drop at 320px; card move buttons already exist as keyboard fallback | `BottomNav`, `ActionsBoard`, `globals.css` | M |
| B6 | **aria-live verbosity tuning** | During streaming, announcements should be throttled (announce once per field/section, not per delta) to avoid screen-reader spam | `ResultsPanel`, `AnalysisChat` | S |

## C. Accessibility (follow-ups from the QA pass)

| # | Item | What / Why | Where | Effort |
|---|------|------------|-------|--------|
| C1 | **Focus trap audit for QuickSearch/ShareDialog** | Verify Tab trapping + focus restore (the repo claims support; the QA pass flagged verifying it in the live build) | `QuickSearch`, `ShareDialog` | S |
| C2 | **Contrast re-check** | Re-check `text-muted` on `bg-surface` and the accent-on-white combinations against WCAG AA for the new chat/voice UI | `globals.css` tokens | S |
| C3 | **Reduced-motion for settle animations** | Ensure `prefers-reduced-motion` fully collapses the new settle/stream animations (existing rule covers most) | `globals.css`, `ResultsPanel` | S |

## D. Reliability / Ops

| # | Item | What / Why | Where | Effort |
|---|------|------------|-------|--------|
| D1 | **Real-service E2E verification** (from the original TODO) | Stripe checkout → webhook → renew; Mailgun outbound + inbound signature path; TokenRouter paid streaming + fallback. Requires live credentials — document results in `docs/` | `src/app/api/billing/*`, `src/lib/mailgun.ts`, `src/lib/inbound.ts` | M (external) |
| D2 | **Zen outage behavior test** | Confirm the cascade falls back to TokenRouter when Zen 5xx/timeouts (existing circuit breaker covers it; add a manual drill) | `src/lib/ai.ts` | S |
| D3 | **Chat PII check in logs** | Extend `logRequest` usage for the new route with zero PII (mirrors SEC-22) and add a test asserting no text lands in logs | `src/app/api/analysis/chat/route.ts`, `src/lib/log.ts` | S |

## E. Content / Legal

| # | Item | What / Why | Where | Effort |
|---|------|------------|-------|--------|
| E1 🎯 | **Privacy policy update** | Document that the analysis chat sends the message + analysis to the AI provider (OpenCode Zen) | `src/app/privacy` | S |
| E2 | **README + feature index update** | Add the two new features to `README.md` and `enhancement-plan/FEATURES-INDEX.md` so the inventory stays current | `README.md`, `enhancement-plan/FEATURES-INDEX.md` | S |
| E3 | **In-app chat disclaimer** | Small mono caption under the chat input: "Answers are based only on this analysis." — sets expectations and reinforces grounding | `AnalysisChat` | S |

---

## Prioritization guide

- **Ship with Features 1–2 (🎯):** A1, A3, B1, B2, E1, E3 — they are direct
  consequences of the new code and cheap to do while the files are open.
- **Next sprint:** B3, B4, D3, E2, A2.
- **Ongoing/verification:** B5, B6, C1–C3, D1, D2, A4 (D1 needs live
  credentials; C/B are QA passes).
