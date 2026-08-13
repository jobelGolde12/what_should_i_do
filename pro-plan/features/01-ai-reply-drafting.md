# Pro Plan — 01 · AI Reply Drafting

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

The headline Pro feature: when a user pastes an **email or message** (or attaches
one — text is already extracted by `InputArea`), TaskMind not only analyzes it but
can **draft a reply**. The user picks a tone, regenerates, and copies the draft.
This turns TaskMind from an analyzer into a finishing tool.

## Where it fits today

`ResultsPanel` renders actions/deadlines/urgency/summary from an `AnalysisResult`
(`src/components/results/ResultsPanel.tsx`); the AI client lives in
`src/lib/ai.ts` with versioned prompts in `src/lib/prompts.ts`; streaming SSE
exists at `src/app/api/analyze/stream/route.ts` + `src/lib/stream.ts`. There is
**no reply generation** anywhere yet.

## Depends on

- `00-entitlements-and-gating.md` (Pro-only route + UI gate)
- Core analysis flow (already shipped)

---

## Tasks

### 1. Reply prompt & tones

- [x] Add `REPLY_PROMPT` and a `TONE_PRESETS` map (`professional`, `casual`,
  `brief`, `warm`) to `src/lib/prompts.ts` (version it like `PROMPT_VERSION`).
- [x] The prompt must consume: the original message, the analysis
  (actions/deadlines/summary), and the tone. Output format: plain-text draft plus
  optional follow-up questions and a short "next step" line.
- [x] Add `tests/prompts.test.ts` asserting the reply prompt includes the tone
  and never instructs model output to be HTML/markdown.

### 2. Draft-reply server path

- [x] Add server action `src/app/actions/draftReply.ts`: input
  `{ message, analysis, tone }` → validated AI JSON/text response, rule-based
  fallback (template reply from actions) when AI is unavailable (mirror
  `analyzeText` fallback posture).
- [x] Add streaming route `src/app/api/reply/stream/route.ts` (SSE, same shape as
  the analyze stream) with size limits, rate limiting, and `requirePro`.
- [x] Add `streamReply()` to `src/lib/stream.ts` (or a sibling `replyStream.ts`)
  reusing heartbeat/timeout logic.

### 3. Attach & extract awareness

- [x] Ensure the drafted reply is generated from the **extracted text** of an
  attached email/message, not just typed input — pass the extracted source through
  `InputArea` → `DashboardHome` → `ResultsPanel` (field already flows into the
  analysis; expose it to the reply panel).
- [x] Show which source the draft is based on (typed text vs. `filename.pdf`
  extracted text) in the reply panel header.

### 4. Reply panel UI

- [x] Add "Draft a reply" action in `ResultsPanel` (button next to Share) gated
  by `usePlan().isPro`; non-Pro sees the `UpgradeCta`.
- [x] Build `src/components/results/ReplyPanel.tsx`: tone chips (presets),
  **Generate**, streaming draft reveal, **Regenerate**, **Copy** (via
  `copyText` from `src/lib/share.ts` + `toast.ts`), and "Start from a template"
  (`src/lib/applyTemplate.ts`).
- [x] Persist the last draft per analysis id so a reload (data-cache warm) keeps
  it; clear on new analysis (mirror `TranslationBlock` state hygiene).

### 5. Copy & export integration

- [x] Wire a "Copy draft" success toast and a keyboard shortcut (`⌘⇧C`) when the
  panel is focused.
- [x] Allow exporting the draft with the analysis (share payload or export — see
  `07-exports-reports-analytics.md`).

### 6. Tests

- [x] Unit: `tests/reply.test.ts` — tone mapping, prompt assembly, fallback reply
  from actions, input validation.
- [x] Route tests: 401/403 for anon/non-Pro, 400 on empty message, 413 on
  oversized input.
- [x] Component test (or manual checklist) for generate/regenerate/copy flows.

## Definition of done

- [x] A Pro user can draft a reply from any pasted or attached message in three
  tones, regenerate it, and copy it in one click.
- [x] Free users see a clear upgrade CTA, never a broken button.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
