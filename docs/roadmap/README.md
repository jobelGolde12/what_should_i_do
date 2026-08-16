# TaskMind — Feature Roadmap & Implementation Docs

This folder holds the detailed documentation and implementation plans for the
features requested in `TODO.md`, plus a curated backlog of other features and
fixes worth including in the same effort.

All plans are grounded in the current codebase (file paths, existing
conventions, design tokens) so each can be picked up and executed without
re-discovery.

---

## Contents

| File | What it covers | Priority |
|------|----------------|----------|
| [`01-voice-reading-translate-summary.md`](./01-voice-reading-translate-summary.md) | **Feature 1 — Voice reading (TTS)** for the translated summary in `TranslationBlock`. Native Web Speech API, per-language voice selection, chunked playback, a11y. | ✅ Implemented |
| [`02-grounded-analysis-chatbot.md`](./02-grounded-analysis-chatbot.md) | **Feature 2 — Grounded analysis chatbot** in the results panel. Predefined prompt chips, answers **only** from the analysis + original message, powered by **OpenCode Zen (`big-pickle`)** with the existing provider cascade as fallback. Responsive, on-theme UI. | ✅ Implemented |
| [`03-additional-features-and-fixes.md`](./03-additional-features-and-fixes.md) | **Backlog** — other features and fixes to fold into this effort (AI provider, UX/UI, a11y, reliability, ops). | 🎯 items shipped |
| [`04-implementation-plan.md`](./04-implementation-plan.md) | **Phased plan** — ordered, checkable tasks with file references and verification steps for everything above. | Phases 0–3 done |

---

## One-paragraph summary

1. **Voice reading (translate summary).** Add a speaker control to the
   "Translate summary" block (`src/components/results/TranslationBlock.tsx`)
   that reads the translated text aloud using the browser's built-in
   `speechSynthesis` (no new dependency, no server round-trip, no cost). The
   right voice is auto-picked per target language (Tagalog/Filipino, Spanish,
   French, German, Italian, Portuguese, English).

2. **Grounded analysis chatbot.** Add a chat panel to the analysis results
   (`ResultsPanel`) so users who don't understand the analysis can ask the AI
   about it. The panel shows predefined questions at the top (e.g.
   *"What does this message really mean?"*). Answers are **grounded**: the
   model receives only the original message + the analysis JSON and is
   instructed to decline anything outside that context. Streaming is served
   by a new `/api/analysis/chat` SSE route that runs through the existing
   provider cascade, with **OpenCode Zen** (`https://opencode.ai/zen/v1`,
   model `big-pickle`) added as a provider (it is free during beta). The UI
   reuses the current theme tokens and is responsive down to 320px.

3. **Backlog.** A curated list of additional features and fixes (provider
   coverage, quota wiring, streaming auto-scroll, share-page gating, privacy
   note updates, tests) documented in `03-additional-features-and-fixes.md`.

---

## Status legend

| Status | Meaning |
|--------|---------|
| 🟢 Ready to build | Scope is clear, codebase references verified |
| 🟡 Decision needed | One design decision blocks implementation (flagged in the doc) |
| 🔴 Blocked | External dependency or missing credential required |

Both features are **implemented** (2026-08) and verified: `npm run typecheck`,
`npm test` (269 passing), `npm run lint`, `npm run build`, and
`npm run security:audit` (0 vulnerabilities) all pass. See
`04-implementation-plan.md` for the completed task list and the two flagged
decision points that were resolved during implementation.
