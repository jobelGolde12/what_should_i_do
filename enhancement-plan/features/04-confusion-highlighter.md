# Feature 04 — Confusion Highlighter

> **Status: DONE** — `ConfusingPart` now carries optional `reason` (missing-info/ambiguity/contradiction/jargon/incomplete), `suggestion`, and `severity`. Rule fallback replaced the generic long-sentence flag with `detectConfusingPart()` (typed reason + human suggestion per trigger); AI prompt emits the enriched schema; both paths dedupe via `dedupeConfusingParts()`. `ConfusingList` renders severity badge + reason label + "Copy clarification question" button. New `HighlightedInput` marks confusing sentences inline in the AnalysisView input preview.

## 1. What it is & its role

The **Confusion Highlighter** identifies ambiguous, incomplete, or complex sentences in the input and explains **why** they are confusing in plain language. It answers: **"What's unclear about this?"** — helping users know what to follow up on before acting.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → system prompt returns `confusingParts: [{ sentence, explanation }]`.
- **Rule fallback:** `src/lib/analyzeRules.ts` → flags sentences longer than 150 chars or containing "subject to"/"accordingly" as confusing with a generic explanation.
- **Type:** `AnalysisResult.confusingParts: { sentence: string; explanation: string }[]`.
- **Rendering:** `src/components/results/ConfusingList.tsx` (collapsible, shows first 2, "N more" expand).

### How it works today
1. The model returns structured `confusingParts`.
2. Rule fallback flags long/complex sentences.
3. `ConfusingList.tsx` renders quoted sentences with their explanations, collapsing extras behind a "show more" button.

### Current limitations
- **Rule fallback gives generic explanations** ("This sentence is long or complex…") — not genuinely helpful.
- No severity rating for confusion.
- No suggested rephrasing / clarification question.
- No mechanism to feed the confusing parts back to the user as prompts to resolve them.
- No persistence of an "unclear items" list that can be converted into follow-up tasks.

## 3. Future enhancements (production-ready Confusion Highlighter)

### 3.1 Semantic confusion detection
- Have the LLM detect: missing information, ambiguous pronouns, contradictory statements, undefined jargon, and incomplete instructions.
- Return a `reason` enum and a `suggestion` (what to clarify or rephrase).

```ts
type ConfusingPartItem = {
  sentence: string;
  explanation: string;
  reason?: 'missing-info' | 'ambiguity' | 'contradiction' | 'jargon' | 'incomplete';
  suggestion?: string;   // what to ask/clarify
  severity?: 'low' | 'medium' | 'high';
};
```

### 3.2 Actionable follow-ups
- Convert each confusing part into a suggested **clarification question** the user can send back to the sender (auto-copy button).
- Optionally add these as "needs clarification" items on the board.

### 3.3 In-text highlighting
- Highlight the confusing sentence inline within the original input preview (not just a separate list).

### 3.4 Confidence & deduplication
- Score and deduplicate similar confusing parts.

### 3.5 Testing
- Evaluation dataset of ambiguous inputs with expected confusing parts.
- Unit tests for the rule fallback's long/complex-sentence detection.

> **Definition of "done" for this feature:** Confusing parts are semantically detected with a reason, severity, and a concrete clarification suggestion, highlighted inline, and convertible into follow-up tasks.
