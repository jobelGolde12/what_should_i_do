# Feature 06 — Summary Generation

> **Status: DONE** — XSS vector removed (`dangerouslySetInnerHTML` → React-safe `SummaryText`), model output sanitized (`sanitizeSummary`), rule summaries rewritten to be domain-agnostic (actions + deadline + urgency) with length caps.

## 1. What it is & its role

The **Summary Generation** feature produces a concise 2–3 sentence, decision-focused summary that answers: **"What happened? What should I do? When?"** It gives users a fast scan-able takeaway without formatting, bullet points, or headers.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → system prompt mandates a concise, decision-focused `summary` string.
- **Rule fallback:** `src/lib/analyzeRules.ts` → `generateDecisionFocusedSummary()` builds a summary from detected decision/reason/timeframe sentences, with special handling for lost-item, found-item, and announcement inputs.
- **Rendering:** `src/components/results/ResultsPanel.tsx` renders the summary HTML (with highlighted phrases) via `dangerouslySetInnerHTML`.

### How it works today
1. The model returns a `summary`; weak summaries (<10 chars) trigger a warning.
2. Rule fallback produces a decision-focused summary from key sentences.
3. `highlightImportantPhrases()` wraps important phrases (e.g., "suspension of face-to-face classes", "effective", "urgent") in `<mark>` tags.
4. The summary is rendered and also fed to the Translation feature (Feature 07).

### Current limitations
- **`dangerouslySetInnerHTML`** renders model-produced HTML — a potential XSS risk if the model output is not sanitized.
- Rule fallback summaries are tailored heavily to *school/weather announcements* (the original use case) and are weak for general emails.
- No length controls or summarization quality checks.
- No separate "detailed" vs "brief" summary.
- The legacy `/api/summarize` route (Feature 22) is a separate, unused offline summarizer.

## 3. Future enhancements (production-ready Summary Generation)

### 3.1 Security — sanitize HTML
- Never render model output as raw HTML. Sanitize with a library (e.g., `DOMPurify`) or render as plain text with a separate safe highlighter that uses React elements instead of `<mark>` string injection.

### 3.2 Model-based summary quality
- Add a `summary_type` control (`brief` / `detailed`).
- Enforce length limits and validate that the summary is non-boilerplate.

### 3.3 General-purpose rule summaries
- Rewrite `generateDecisionFocusedSummary()` to be domain-agnostic (actions + top deadline + urgency) rather than announcement-specific.

### 3.4 Multi-paragraph summary fallback
- Support longer inputs with section-level summaries.

### 3.5 Translation integration
- Keep the summary as the canonical text passed to translation; ensure translated summaries are also sanitized.

### 3.6 Testing
- XSS injection tests ensuring model output cannot execute scripts.
- Unit tests for summary generator across varied input types.

> **Definition of "done" for this feature:** Summaries are generated safely (no HTML injection), are domain-agnostic, length-controlled, and fully covered by tests.
