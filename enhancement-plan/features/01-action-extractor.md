# Feature 01 — Action Extractor

> **Status: DONE** — Added `src/lib/actionUtils.ts` (bilingual EN/TL `ACTION_LEXICON`, `categorizeAction`, `extractActionPhrase`, `dedupeActions`, `cleanActionText`); wired into `analyzeRules.ts` (replaces old `ACTION_VERBS`); `ActionList` is now an interactive checklist with category tags and per-item done/todo toggling wired through `ResultsPanel` → `DashboardHome`/`AnalysisView` → `TaskContext.setItemStatus`.

## 1. What it is & its role

The **Action Extractor** is the core value proposition of TaskMind. It takes messy, unstructured text (emails, memos, announcements, group messages, notices) and converts the requests/instructions hidden inside into a clear, checklist-style list of **actionable items** — the concrete things a user must actually *do*.

Its role is to answer the question: **"What do I need to do from this message?"** It is deliberately *not* a summarizer; it focuses on extracting *verbs-driven tasks* (submit, attend, pay, respond, bring, register, etc.) so the user can act.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → `buildAnalysisMessages()` (system prompt instructs the model to return an `actions` array).
- **Rule-based fallback:** `src/lib/analyzeRules.ts` → `analyzeWithRules()` uses `ACTION_VERBS` keyword matching.
- **Type definition:** `src/app/actions/analyzeText.ts` → `AnalysisResult.actions: string[]`.
- **Rendering:** `src/components/results/ActionList.tsx` renders a numbered checklist.
- **Pipeline:** `src/app/actions/analyzeText.ts` (`analyzeText`) and `src/app/api/analyze/stream/route.ts` (streaming).

### How it works today
1. User pastes text or uploads a file (see Feature 08).
2. Text is cleaned/normalized (`cleanText`) and enhanced (`enhanceInput`).
3. Primary path: OpenRouter (Claude Sonnet) is prompted to return a JSON `actions` array.
4. Fallback path (`analyzeWithRules`): scans sentences for `ACTION_VERBS` (`submit`, `attend`, `pay`, `respond`, `bring`, `fill out`, `register`, `watch`, `send`, `reply`) and pushes matching sentences as actions.
5. Actions render as a numbered checklist in `ActionList.tsx`.
6. Each action is also pushed to the Actions Board (Feature 12) as a `todo` item via `TaskContext.saveAnalysis`.

### Current limitations
- **Rule fallback is shallow:** keyword matching pushes *whole sentences* as actions rather than extracting the specific verb phrase. It misses paraphrases, negations, and implicit instructions.
- **No deduplication** of near-identical actions.
- **No categorization** (e.g., "financial", "administrative", "attend/cancel").
- Actions are not associated with their deadlines or source sentences structurally.
- No "check off" UI on the results panel itself (only via the Actions Board).
- No confidence score or user confirmation of extracted actions.

## 3. Future enhancements (production-ready Action Extractor)

### 3.1 Precise phrase-level extraction
- Replace whole-sentence capture with **dependency/verb-phrase extraction** so only the actionable verb+noun phrase is kept (e.g., "Submit the final project via the online portal" rather than the entire paragraph).
- Add a much larger, localized action-verb lexicon (English + Filipino) including common colloquial verbs.

### 3.2 Structured action model
Evolve `actions: string[]` into a richer structure while keeping backward compatibility:

```ts
type ActionItem = {
  id: string;
  text: string;          // the action phrase
  verb?: string;         // normalized verb
  category?: 'attend' | 'pay' | 'submit' | 'communicate' | 'document' | 'other';
  deadline?: string;     // linked deadline id/text
  assignee?: string;     // who is required to act (you, team, etc.)
  sourceSentence?: string; // provenance
  confidence?: number;     // 0..1
  status?: 'todo' | 'in-progress' | 'done';
};
```

### 3.3 Deduplication & normalization
- Remove duplicate/near-duplicate actions using string similarity (e.g., Levenshtein or token Jaccard).
- Normalize verb tense and expand contractions.

### 3.4 Confidence scoring & user confirmation
- Have the model return a `confidence` per action.
- Show low-confidence actions in a "review" state so users can accept/reject before they land on the board.

### 3.5 Action → task integration
- One-click "Send to board" or "Create task" per action.
- Auto-linking each action to its deadline and urgency (cross-feature).

### 3.6 Testing & evaluation
- Build a labeled evaluation dataset (English + Filipino) with unit tests asserting extraction precision/recall.
- Add regression tests for the rule fallback covering edge cases (negation, passive voice, multi-action sentences).

### 3.7 Accessibility & UX polish
- Make the checklist interactive (checkbox to mark done) with focus states and `aria` labels.
- Keyboard navigation between action items.

> **Definition of "done" for this feature:** Actions are precise, deduplicated, categorized, confidence-scored, linked to deadlines/urgency, and fully covered by automated tests across languages.
