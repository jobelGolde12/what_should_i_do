# Feature 05 — Next-Step Guidance

> **Status: DONE** — `nextStep` is now structurally linked via new optional `nextStepReason` + `nextStepActionIndex` fields (type, both normalizers, AI prompt updated). Rule fallback uses `pickNextStep()`: ranks actions by per-action urgency → nearest deadline mentioned in the action → lexical order, with a human-readable reason. `NextStepCard` renders the reason and a "Mark as done" button that toggles the linked action.

## 1. What it is & its role

The **Next-Step Guidance** feature provides a single, prioritized recommendation: **"If you do only one thing, do this."** It cuts through the full list of actions and tells the user the *most important next action* to take right now.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → system prompt returns a `nextStep` string.
- **Rule fallback:** `src/lib/analyzeRules.ts` → `nextStep` defaults to the first action, or a lost/found-item hint, or "No immediate action required."
- **Rendering:** `src/components/results/NextStepCard.tsx` (accent-bordered highlighted card).

### How it works today
1. The model returns a `nextStep` string.
2. Rule fallback derives it from the first action or context.
3. `NextStepCard.tsx` renders it in a visually prominent "If you do only one thing" card.

### Current limitations
- `nextStep` is just a string — no structured link to a specific action.
- No "why" explanation for why this step is prioritized.
- Rule fallback simply picks the first action, which may not be the most important.
- No action to act directly on the next step (e.g., "mark done", "add reminder").

## 3. Future enhancements (production-ready Next-Step Guidance)

### 3.1 Structured recommendation
```ts
type NextStep = {
  text: string;
  linkedActionId?: string;  // which action this corresponds to
  reason?: string;          // why this is the priority
  dueWithin?: string;       // e.g., "within 24h"
};
```

### 3.2 Prioritization logic
- Prioritize by: urgency level → nearest deadline → importance rank → lexical order.
- Allow the model to explain the priority in one sentence.

### 3.3 One-click actions
- "Mark as done" button that updates the linked action/board item.
- "Remind me" to schedule a notification for this step.

### 3.4 Guidance tone & accessibility
- Ensure the card is keyboard-focusable and screen-reader friendly.
- Provide a fallback when no clear next step exists (already handled, but refine copy).

### 3.5 Testing
- Unit tests for the priority-ordering logic.
- Evaluation of model-generated next steps against a labeled dataset.

> **Definition of "done" for this feature:** The next step is structurally linked to an action, prioritized by clear rules, explainable, and actionable (done/remind) from the UI.
