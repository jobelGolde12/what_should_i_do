# AI Analysis Enhancement Plan — Accurate Results via TokenRouter

> **Goal:** Make TaskMind's analysis results fully **AI-powered and highly accurate** by adopting **TokenRouter** as the primary model provider (replacing/deprecating the current hardcoded OpenRouter client), with a hardened pipeline that reliably returns structured, valid, precise analysis for every input — **and presents that analysis in a way that is easy for any user to understand at a glance.**

---

## 1. Context & Problem Statement

### 1.1 Current state
Today TaskMind calls **OpenRouter** directly from `src/lib/openrouter.ts` (model `anthropic/claude-sonnet-5`, up to 3 hardcoded keys `OPENROUTER_API_KEY1/2/3`). The analysis result is a structured object:

```ts
type AnalysisResult = {
  actions: string[];
  deadlines: string[];
  urgency: "Urgent" | "Important" | "Informational";
  confusingParts: { sentence: string; explanation: string }[];
  nextStep: string;
  summary: string;
  analysisMethod: "ai" | "fallback";
};
```

### 1.2 Problems with the current approach
- **Tight coupling to one provider** — code, prompt, and keys are all OpenRouter-specific.
- **No automatic model/route selection** — the developer must pick the model manually.
- **Inconsistent accuracy** — a single fixed model may underperform on ambiguous/messy inputs (garbled OCR, code-switched Tagalog-English, mixed announcements).
- **No reliability recovery** beyond basic key rotation; no request timeouts, backoff, or circuit breaking.
- **No validation of shape** beyond shallow checks — malformed model output can slip through.
- Result can silently degrade to the **rule-based fallback**, which is far less accurate.
- **Verbatim phrasing:** actions are often copied verbatim from long sentences, deadlines repeat the raw wording, and confusion explanations can be technical — making results hard to read.

### 1.3 Vision
Introduce **TokenRouter** as the model provider to:
- Route each request to the **best available model** for the task (accuracy-optimized).
- Provide **automatic retries/failover** to alternate models on errors, rate limits, or quality issues.
- Return **consistent JSON** via a provider-agnostic, model-agnostic interface.
- Give a single API key as the access credential (optionally with organization/api-key-specific routing).
- Keep the rule-based fallback only as a last resort, and mark clearly when it is used.
- **Rewrite and structure** the output so every field is short, plain, and instantly understandable (see **Section 5A**).

---

## 2. What is TokenRouter & Role

**TokenRouter** is an AI gateway / model-routing service (OpenAI-compatible) that:
- Exposes **one endpoint** and **one API key** to reach many underlying models (OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, etc.).
- Can **route** requests automatically to the best/cheapest/fastest model, or target a specific model/capability tag.
- Handles retries, fallbacks, load balancing, and provider failover on your behalf.
- Returns streaming responses compatible with the SSE format used by TaskMind's existing streaming pipeline.

**Role in TaskMind:** TokenRouter becomes the **primary AI analysis engine** (`src/lib/ai.ts`), replacing the OpenRouter-specific client, while keeping the response contract (with *enriched* fields) so the downstream UI (ResultsPanel, board, history, share) works and reads better.

---

## 3. Credentials & `.env` Configuration

TokenRouter follows an **OpenAI-compatible** credentials model.

### 3.1 Environment variables to add

Add these to `.env.local` (and to your deployment platform's env vars):

```dotenv
# ── TokenRouter (Primary AI Provider) ─────────────────────────
TOKENROUTER_API_KEY=tr-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
# Optional: pin to a specific model / route tag.
# If blank, TokenRouter auto-routes to the best model for the task.
TOKENROUTER_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free

# ── Retained for the rule-based fallback message only (optional) ──
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

### 3.2 Field-by-field explanation

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKENROUTER_API_KEY` | **Yes** | Your TokenRouter secret key (created in the TokenRouter dashboard). It identifies your account for auth and billing. |
| `TOKENROUTER_BASE_URL` | Optional | API base URL. Default (if omitted): `https://api.tokenrouter.com/v1`. Override only if TokenRouter for you uses a custom/subdomain endpoint. |
| `TOKENROUTER_MODEL` | Optional | A concrete model id (e.g. `anthropic/claude-sonnet-5`) **or** a routing tag. If left empty, TokenRouter auto-selects the best route for the `analysis` task. |
| `NEXT_PUBLIC_APP_URL` | No | Your app's canonical public URL, used for `HTTP-Referer`/`X-Title` style provider metadata and canonical URLs. |

> **Security rule:** `TOKENROUTER_API_KEY` must **never** be exposed to the client. It is only read server-side via `process.env.TOKENROUTER_API_KEY`. Do **not** prefix it with `NEXT_PUBLIC_`.

### 3.3 Example `.env.local`

```dotenv
TOKENROUTER_API_KEY=tr-XXXXXXXXXXXXX
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
NEXT_PUBLIC_APP_URL=https://taskmind.app
```

---

## 4. Architecture Change

### 4.1 New abstraction: `src/lib/ai.ts`
Create a provider-agnostic AI client (`TokenRouter` + optional provider failover). Target:

```ts
// src/lib/ai.ts
class AIClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string | undefined;

  constructor() { /* reads process.env.TOKENROUTER_* */ }

  /** Non-streaming structured JSON request with retries + validation. */
  async analyzeStructured(input: string): Promise<AnalysisResult>;

  /** Streaming variant returning raw text deltas (used by /api/analyze/stream). */
  async streamStructured(input: string, onDelta: (acc: string) => void): Promise<string>;
}

export const aiClient = new AIClient();
```

### 4.2 Wiring changes

| File now | Change |
|----------|--------|
| `src/lib/openrouter.ts` | **Deprecate.** Move its retry/failover logic into `src/lib/ai.ts`. Keep `openrouter.ts` only for backward compat or remove the import. |
| `src/app/actions/analyzeText.ts` | Point `analyzeWithOpenRouter()` → `aiClient.analyzeStructured()`. |
| `src/app/api/analyze/stream/route.ts` | Replace `openRouterAPI.streamRaw()` → `aiClient.streamStructured()`. |
| `src/lib/analyzeRules.ts` | Keep as the final fallback; add detection that marks `analysisMethod: "ai" | "fallback"`. |
| Debug routes | Update to test the new `aiClient`. |

- Update the type/schema validation to a **strict schema** (see §6).

### 4.3 Enrich the result schema (for understandability)
Introduce normalized, human-friendly fields while keeping backward compatibility for existing UI:

```ts
type ActionItem = {
  text: string;          // short, normalized action phrase (see §5A)
  verb?: string;         // normalized verb, e.g. "submit"
  category?: 'attend' | 'pay' | 'submit' | 'communicate' | 'document' | 'other';
};

type DeadlineItem = {
  raw: string;           // original wording
  label: string;         // clean, human-readable date/time, e.g. "Fri, Nov 24, 5:00 PM"
  parsed: string | null; // ISO timestamp when parseable
};

type ConfusingPartItem = {
  sentence: string;      // the confusing snippet (shortened)
  explanation: string;   // plain-language, non-technical explanation
  suggestion?: string;   // what to ask/clarify (optional)
};

type AnalysisResult = {
  actions: ActionItem[];                     // or keep string[] + parallel meta
  deadlines: DeadlineItem[];
  urgency: "Urgent" | "Important" | "Informational";
  urgencyReason?: string;                    // why it's this level
  confusingParts: ConfusingPartItem[];
  nextStep: string;                          // one short, actionable sentence
  summary: string;                           // 1–2 plain sentences
  analysisMethod: "ai" | "fallback";
};
```

> Keep the existing `string[]` shapes readable by the UI during a transition via a normalization shim, then migrate the UI to the richer shapes.

---

## 5. Accuracy Strategy

The core requirement is **accurate results**. This plan introduces multiple layers of accuracy.

### 5.1 Prompt engineering (accuracy-first)
- Move the prompt to a **versioned prompt module** (`src/lib/prompts.ts`) so it is testable and improvable.
- Add **few-shot examples** (English + Tagalog/code-switched) showing the exact JSON shape.
- Strengthen **explicit instructions** for: action phrase extraction, deadline parsing, urgency calibration, and summary decision-focus.
- Include **output constraints**: valid JSON only, allowed urgency values, array types.

### 5.2 Model routing via TokenRouter
- Configure `TOKENROUTER_MODEL` to a **routing tag** (e.g. `analysis-high-accuracy`) if TokenRouter supports capability tags, so it auto-selects the best model.
- Otherwise pin to a high-accuracy model id.
- Leverage TokenRouter's built-in **failover/retry** so a provider outage doesn't drop accuracy.

### 5.3 Structured output / JSON mode
- Request `response_format: { type: "json_object" }` from compatible routes.
- **Strip fences** (already done via `stripFences`) and repair common malformed JSON (truncated arrays) with a lenient parser before failing.

### 5.4 Post-processing validation & repair (schema validation)
Use a validation library (e.g. **zod**) to guarantee the shape:

```ts
import { z } from "zod";

const AnalysisRawSchema = z.object({
  actions: z.array(z.string()),
  deadlines: z.array(z.string()),
  urgency: z.enum(["Urgent", "Important", "Informational"]),
  confusingParts: z.array(z.object({
    sentence: z.string(),
    explanation: z.string(),
  })),
  nextStep: z.string(),
  summary: z.string(),
});
```

- Validate each response; on failure, apply **repair rules**:
  - Clamp urgency to valid values (fallback `Informational`).
  - Coerce arrays to `[]` if missing.
  - Truncate/trim long fields.
  - Trim any markdown fences.
- **If validation+repair still fails** and the model is unreliable, **retry once on a different route** (TokenRouter routing may pick an alternate model).

### 5.5 Multi-attempt routing (accuracy recovery)
Implement a **bounded attempt loop**:
1. Attempt 1 — primary model/route.
2. On invalid JSON or error → attempt 2 with a different model (if `TOKENROUTER_MODEL` is a static id) or let TokenRouter re-route.
3. Attempt 3 — final, then fall back to rules.
Record which attempt/model produced the result for diagnostics.

### 5.6 Language normalization
- Reuse/expand `enhanceInput()` for messy/OCR text.
- Add **code-switch hints** (Tagalog-English) to the prompt.

### 5.7 Confidence & quality signals (accuracy transparency)
- Return a per-field or overall `confidence` (0–1) from the model, and surface low-confidence fields in the UI so users can review. (Refines nearest Feature 01/03.)

### 5.8 Regression evaluation harness
- Build a labeled **evaluation dataset** (`evaluation/cases/*.json`) with expected outputs.
- Add a script `npm run eval` that runs the analyzer across the dataset and reports **precision / recall / exact-match / accuracy**.
- Gate accuracy improvements behind this metric.

---

## 5A. Making Results Easy to Understand

Accurate extraction is only half the goal. **The output must be readable at a glance.** This section defines the readability rules the model must follow and the UI adjustments that surface them.

### 5A.1 Actions — short, imperative, informative
Rule the model follows (`src/lib/prompts.ts`):
- Rewrite each action as a **short imperative sentence** beginning with a strong verb.
- Strip filler, names-only headers, and unrelated clauses.
- Include the **what** and **when/where** only if it adds value in ≤ ~12 words.
- **Examples:**
  - Long: *"Submit the final project via the online portal before Friday so the team can review it on Monday morning."*
  - Rewritten: **"Submit the final project on the portal by Friday."**
  - Long: *"Please don't forget to attend the mandatory presentation that will be held tomorrow at 10 AM in the main hall."*
  - Rewritten: **"Attend the presentation tomorrow at 10 AM (main hall)."**

UI adjustments:
- Render each action as a **checkable checkbox** with the short text (interactive).
- Group by **category** (e.g., "To submit", "To attend") with small section labels.
- Show a **verb chip** on each action for scanning.

### 5A.2 Deadlines — clean labels, not raw wording
Rule:
- Never echo the raw sentence. Produce a **normalized label**, e.g. `"Fri, Nov 24 · 5:00 PM"`.
- Preserve the original only as an optional tooltip.
- If a date can't be parsed, show a **plain relative phrase** (`"End of month"`).

UI adjustments:
- Render deadlines as a **sorted-by-date list** with a calendar icon.
- Show **"overdue"** in red for past dates.
- Keep the **Export .ics** button (already present).

### 5A.3 Unclear section — simple, actionable explanations
Rule:
- `explanation` must be **one plain sentence** a non-expert understands (no jargon).
- Add an optional `suggestion` — **what to ask the sender** to clarify (e.g., "Ask: 'What is the penalty for late submission?'").
- Keep `sentence` short (truncate to ~10–12 words with `…`).

UI adjustments:
- Render each unclear part as a **quote + one-line explanation**.
- Add a **"Copy question to ask"** button that copies the suggestion to the clipboard.
- Keep the existing "show more" collapse for long lists.

### 5A.4 Next step — one sentence, imperative
Rule:
- Rewrite as **"<Verb> <what> <by when>"** in ≤ ~15 words.
- Must be derived from the top action + nearest deadline.
- Example: **"Prepare for tomorrow's presentation; submit the project by Friday."**

### 5A.5 Summary — 1–2 plain sentences
Rule:
- Answer: **What happened? What should I do? When?**
- Max ~40 words, no bullets, no headers.
- Example: **"Classes are suspended today due to heavy rainfall. No action needed unless you must report to campus."**

### 5A.6 Urgency — add a reason
Rule:
- Return `urgencyReason` (≤ ~12 words), e.g. **"Deadline is within 24 hours."**
UI:
- Show the reason beside the urgency badge/meter as a muted subtitle.

### 5A.7 Tone & language consistency
- Keep the output **in the same language as the input** (or English by default; Filipino when the input is Filipino/code-switched).
- Use **sentence case**, no ALL-CAPS, no emoji spam, no markdown inside fields.

### 5A.8 Readability evaluation (added to the eval harness)
- Extend `evaluation/cases/*.json` with expected **short-form** outputs.
- Add metrics: **average action length (words)**, **% actions starting with a verb**, **% deadlines with a parsed label**, **% unclear explanations in plain language**, and **duplicate-action rate**.
- Enforce ceilings (e.g., max action length) in CI.

---

## 5B. Improving the AI Response to Match the User's Input

Beyond general accuracy, the model must **respond appropriately to what the user actually wrote** — intent, tone, type, and language — and not over- or under-react.

### 5B.1 Message-type detection
Add a `messageType` field the model infers and returns:
```ts
type MessageType = "announcement" | "lost-item" | "found-item" | "meeting" | "instruction" | "reminder" | "notice" | "general";
```
- The prompt instructs the model to set urgency **relative to the message type** (e.g., lost-item → Informational unless stated; safety alerts → Urgent).
- The UI shows a small **type badge** ("Announcement", "Lost item", …) so the user sees the system understood the context.

### 5B.2 Faithfulness to the input (no hallucination)
- Add an explicit instruction: **"Only include facts present in the text. Do not invent deadlines, names, or actions."**
- Where the model is unsure, put that in `confusingParts` rather than guessing.
- Post-process check: extracted actions/deadlines must contain at least one token present in the input; otherwise flag low confidence.

### 5B.3 Handling messy / OCR / code-switched text
- Expand `enhanceInput()` with more Filipino slang, chat abbreviations, and OCR corrections.
- Add prompt guidance: **"This text may contain typos or OCR errors. Interpret the likely intended meaning."**
- Add few-shot examples for garbled and code-switched inputs.

### 5B.4 Negation & subtlety awareness
- Teach the model to detect **negation** ("no need to reply", "don't submit") so it does NOT turn those into actions.
- Detect **permission vs requirement** ("you may" vs "you must") and only extract actions for requirements.

### 5B.5 Multi-intent splitting
- Split a single input containing several topics into **discrete actions/deadlines** rather than one merged blob.
- Group related items so the list stays scannable.

### 5B.6 Confidence-gated rendering
- If the model's overall `confidence` is low, the UI shows a subtle **"Review: the input was unclear"** callout instead of presenting everything as certain.

### 5B.7 Targeted system prompt (response template)
Provide the model a **response template** so it always returns the same shape with the readability rules baked in:

```
Return ONLY JSON:
{
  messageType: "...",
  actions: ["<short imperative action>", ...],
  deadlines: ["<normalized label>", ...],
  urgency: "Urgent"|"Important"|"Informational",
  urgencyReason: "...",
  confusingParts: [{"sentence":"...","explanation":"plain...","suggestion":"Ask: ..."}],
  nextStep: "...",
  summary: "...",
  confidence: 0.0-1.0
}
Rules:
- Actions start with a verb, ≤12 words.
- Deadlines are clean labels, not raw sentences.
- Explanations are plain language; include a suggestion when possible.
- NextStep is one short imperative sentence.
- Summary answers What / Should I do / When in ≤40 words.
- Only use facts in the input. Never invent.
- Match the input language.
```

---

## 6. Reliability & Resilience

### 6.1 Timeouts & cancellation
- Add an **AbortController** with a configurable timeout (e.g. 60s) to both non-streaming and streaming requests.
- Surface "timed out" errors distinctly.

### 6.2 Retries & backoff
- Retry transient failures (429, 5xx, network) with **exponential backoff + jitter** (e.g. 500ms → 1s → 2s), capped attempts.
- On provider-level errors, let **TokenRouter failover** handle route switching; locally only retry what isn't already covered.

### 6.3 Circuit breaker
- Track recent failures; if a route path is failing repeatedly, temporarily mark it unhealthy and route elsewhere.

### 6.4 Input limits
- Enforce max input length (e.g. 20,000 chars) and reject oversize with a clear error; chunk if we later support longer docs.

### 6.5 Logging & observability
- Log: model/route used, attempt number, latency, token usage, and whether fallback triggered — **without logging the raw text**.
- Struct log for any SIEM/analytics pipeline (e.g., pino).

---

## 7. Streaming Integration (reuse current UX)

TokenRouter returns **OpenAI-compatible SSE**, which matches the existing `/api/analyze/stream` pipeline.

- `aiClient.streamStructured()` reads the SSE stream, accumulates JSON text, and reuses `streamParse.extractCompletedFields()` so sections reveal progressively (Actions → Dealine → Urgency → …) exactly as today.
- Keep the "settling" animation and the `done` event returning the fully-validated result.
- Add client-side **timeout + abort** (see Feature 10) so users can cancel a stuck stream.
- Stream the **enriched fields** (messageType, urgencyReason, suggestions) so the UI can reveal them progressively too.

---

## 8. UI & Component Adjustments (readability)

Beyond model output, update the components so the friendlier data is actually shown:

| Component | Change |
|-----------|--------|
| `src/components/results/ActionList.tsx` | Render short imperative actions as **checkboxes**, group by category, show verb chips. |
| `src/components/results/DeadlineList.tsx` | Show **normalized labels** sorted by date, mark overdue, keep .ics export. |
| `src/components/results/ConfusingList.tsx` | Show **plain one-line explanations** + a **"Copy question to ask"** button. |
| `src/components/results/NextStepCard.tsx` | Keep the highlighted card; ensure text is one short imperative sentence. |
| `src/components/results/ResultsPanel.tsx` | Add a **message-type badge** and **urgency reason** subtitle to the header. |
| `src/components/results/UrgencyMeter.tsx` | Optionally show the `urgencyReason` under the meter. |

---

## 9. Implementation Steps (ordered)

1. **Add env vars** — document and add `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL`, `TOKENROUTER_MODEL` to `.env.example` and `.env.local`.
2. **Create `src/lib/prompts.ts`** — extract + version the analysis prompt, add few-shot examples, output constraints, **readability rules (§5A)**, and **response template (§5B)**.
3. **Create `src/lib/ai.ts`** — TokenRouter client with:
   - OpenAI-compatible chat completions (non-streaming + streaming).
   - `response_format: { type: "json_object" }`.
   - Timeouts, retry/backoff, circuit breaker, token/usage reporting.
4. **Add strict schema validation + repair** — `src/lib/validateAnalysis.ts` using zod (`npm install zod`), plus a **normalization shim** for the enriched fields.
5. **Wire `analyzeText` action** — replace OpenRouter call with `aiClient.analyzeStructured()`; keep rules as the final fallback.
6. **Wire streaming route** — replace `openRouterAPI.streamRaw()` with `aiClient.streamStructured()`.
7. **Update the rule fallback labeling** — ensure `analysisMethod` correctly marks fallback use.
8. **Update debug routes** — test the new `aiClient` directly and surface key/model/attempt usage.
9. **Remove/soft-deprecate `openrouter.ts`** and its keys from `.env` docs; remove `OPENROUTER_API_KEY1/2/3` or keep only for transitional fallback.
10. **Add the evaluation harness** (`npm run eval`) with an initial dataset, **including readability metrics (§5A.8)**.
11. **Apply UI/component adjustments** (§8) to surface the friendlier fields.
12. **Add unit + integration tests** (mocked TokenRouter responses: success, invalid JSON, 429, 5xx, timeout, empty).
13. **Update docs** — `docs/analyze-results-not-working.md` and `enhancement-plan/README.md`.

---

## 10. Environment Checklist

Create an `.env.example` entry:

```dotenv
# ── TokenRouter (primary AI) ──────────────────────────────
TOKENROUTER_API_KEY=
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=
```

And keep the legacy OpenRouter variables only while running the transition:

```dotenv
# Legacy (transitional; to be removed after migration)
# OPENROUTER_API_KEY1=
# OPENROUTER_API_KEY2=
# OPENROUTER_API_KEY3=
```

---

## 11. Definition of Done (Production-Ready, Accurate & Understandable)

This plan is complete when:
- [x] **TokenRouter** is the primary provider, configurable via `.env` (`TOKENROUTER_API_KEY`, `BASE_URL`, `MODEL`).
- [x] Analysis is **AI-powered end-to-end** with structured JSON output.
- [x] Responses are **schema-validated and auto-repaired**; invalid output triggers a secondary route retry.
- [x] Routing/failover yields accurate results across messy, multilingual, and low-quality inputs.
- [x] **Actions are short imperative sentences** (≤ ~12 words) that start with a verb and are informative.
- [x] **Deadlines are clean labels** (parsed dates/times), sorted, and overdue-aware.
- [x] **Unclear section explanations are plain-language** and include a "what to ask" suggestion.
- [x] **Next step and summary are short, plain, decision-focused sentences.**
- [x] **The model responds faithfully to the input** — correct message type, no invented facts, negation-aware, language-matched.
- [x] Streaming still reveals sections progressively and is **timeout + abort safe**.
- [x] Rule-based fallback is last-resort-only and clearly flagged.
- [x] An `npm run eval` harness reports **accuracy + readability metrics** over a labeled dataset.
- [x] Unit/integration tests cover success, malformed JSON, rate limits, timeouts, and fallback.
- [x] Docs (`.env`, README, troubleshooting) are updated; legacy OpenRouter references removed.

---

## 12. Related feature files (reference)

- [`features/09-ai-backend-fallback.md`](./features/09-ai-backend-fallback.md) — reliability/fallback hardening.
- [`features/10-streaming-analysis.md`](./features/10-streaming-analysis.md) — streaming robustness.
- [`features/01-action-extractor.md`](./features/01-action-extractor.md) — action accuracy.
- [`features/02-deadline-detector.md`](./features/02-deadline-detector.md) — deadline parsing.
- [`features/04-confusion-highlighter.md`](./features/04-confusion-highlighter.md) — plain-language unclear parts.
- [`features/06-summary-generation.md`](./features/06-summary-generation.md) — summary quality & XSS.
