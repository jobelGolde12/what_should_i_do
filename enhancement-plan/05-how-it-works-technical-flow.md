# How It Works (Technical Flow) — Detailed Plan

This document breaks down the full technical flow of a single analysis request, with exact code locations.

---

## End-to-End Flow

```
User pastes text / uploads file
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ CLIENT (src/components/main-input-area/page.tsx)        │
│ 1. Text entered directly OR file uploaded:              │
│    - .txt   → file.text()                               │
│    - .pdf   → pdfjs-dist (CDN worker)                   │
│    - .docx  → mammoth.extractRawText({ arrayBuffer })   │
│    - image  → tesseract.js OCR (eng)                    │
│ 2. handleAnalyze(text) → analyzeText(finalText)         │
└─────────────────────────────────────────────────────────┘
        │  (server action, "use server")
        ▼
┌─────────────────────────────────────────────────────────┐
│ SERVER ACTION (src/app/actions/analyzeText.ts)          │
│ 1. cleanText(input)  → strip gov header/boilerplate,    │
│                        remove emails/dates/times        │
│ 2. enhanceInput(cleaned) → fix OCR typos, expand slang, │
│                        normalize punctuation            │
│ 3. if enhanced.length < 10 → throw INPUT_TOO_SHORT      │
│ 4. try analyzeWithOpenRouter(enhanced)                  │
│       └─ on success → return { ... , analysisMethod:"ai"}│
│ 5. catch → if ALL_KEYS_EXHAUSTED rethrow, else          │
│    analyzeWithRules(enhanced) → { ..., "fallback"}      │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ OPENROUTER (src/lib/openrouter.ts)                      │
│ OpenRouterAPI.analyzeText(normalizedInput)              │
│ 1. normalizeInput: collapse newlines/whitespace,        │
│    strip non-ASCII                                     │
│ 2. Build system prompt (JSON mode, urgency rules)       │
│    + user message "Analyze this message: ..."           │
│ 3. Loop API_KEYS in order:                              │
│    - skip exhausted/rate-limited keys                   │
│    - makeRequest(messages, keyIndex)                    │
│    - on retryable error → record status, next key       │
│    - on success → JSON.parse + validateAndNormalize     │
│ 4. Return normalized shape (see below)                  │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ FALLBACK (analyzeWithRules in analyzeText.ts)           │
│ - split into sentences (>20 chars, filters)             │
│ - actions via ACTION_VERBS + class-suspension special   │
│ - deadlines via DEADLINE_REGEX                          │
│ - confusingParts via length/关键词 heuristics            │
│ - urgency via lost/found + URGENT_KEYWORDS + deadlines  │
│ - nextStep from first action or contextual default      │
│ - summary via generateDecisionFocusedSummary()          │
│ - highlightImportantPhrases() wraps key phrases in <mark>│
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ RENDER (src/components/main-input-area/page.tsx)        │
│ Urgency pill → Actions list → Deadlines list →          │
│ ConfusingParts → Next Step box → Summary (with AI/      │
│ Basic badge) → TranslatedResult → AdsContainer          │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1 — Client-side text extraction

File: `src/components/main-input-area/page.tsx` — `handleFileUpload(file)`

- **TXT:** `await file.text()`.
- **PDF:** dynamic `import("pdfjs-dist")`, sets `GlobalWorkerOptions.workerSrc` from CDN matching `pdfjsLib.version`, iterates pages, joins `content.items` text (`'str' in item ? item.str : ''`).
- **DOCX:** `mammoth.extractRawText({ arrayBuffer: buffer })` → `result.value`.
- **IMAGE:** `Tesseract.recognize(file, "eng", { logger: () => {} })` → `ocrResult.data.text`.

After extraction: `setText(extractedText)` then `await handleAnalyze(extractedText)`.

---

## Step 2 — Server action entry point

File: `src/app/actions/analyzeText.ts`

```ts
export async function analyzeText(input: string): Promise<AnalysisResult> {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);
  if (enhanced.length < 10) {
    throw createError("Text too short - please provide more content", 'INPUT_TOO_SHORT');
  }
  try {
    return await analyzeWithOpenRouter(enhanced);
  } catch (error) {
    console.warn('OpenRouter failed, falling back to rules:', getErrorMessage(error));
    if (error instanceof AnalysisError && error.code === ERROR_CODES.ALL_KEYS_EXHAUSTED) {
      throw error;
    }
    return analyzeWithRules(enhanced);
  }
}
```

Also exported:
- `analyzeTextFast(input)` → always rules (fast mode).
- `analyzeTextsBatch(texts)` → loops `analyzeText`, per-item fallback to rules on error.

---

## Step 3 — Input cleaning & enhancement

### `cleanText(text)` removes:
- Consecutive newlines/whitespace, non-ASCII.
- Government boilerplate: `"office of the municipal mayor.*?(?=re\s*:)"`, `"local government unit.*?(?=office)"`.
- Emails (`email:.*?\s`), memoranda (`s&f office memorandum no\..*?series of \d{4}`).
- All-caps `X & Y` phrases, times (`\d{1,2}:\d{2}\s*(am|pm|a.m.|p.m.)`), day names, and full dates (`month day, year`).

### `enhanceInput(input)`:
- OCR typo fixes (`c1asses`→`classes`, `t0day`→`today`, `w/`→`with`, `pls`→`please`, `r`→`are`, etc.).
- Punctuation normalization (`. , ; : ! ?` → `. `).
- Appends `"(Please analyze this brief message for any actions, deadlines, or urgency)"` if text is `< 30` chars.

---

## Step 4 — OpenRouter request details

File: `src/lib/openrouter.ts`

- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`
- **Model:** `anthropic/claude-3.5-sonnet`
- **Headers:** `Authorization: Bearer <key>`, `HTTP-Referer: NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`, `X-Title: 'TaskMind - Text Analysis'`
- **Body:**
  ```json
  {
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [ { "role": "system", "content": "<systemPrompt>" }, { "role": "user", "content": "Analyze this message: \"...\"" } ],
    "temperature": 0.1,
    "max_tokens": 900,
    "response_format": { "type": "json_object" }
  }
  ```
- **System prompt highlights:**
  - Identify message type (announcement, lost item, meeting, instruction…).
  - Extract actions/deadlines/urgency, summarize, next step.
  - **Urgency rules:** lost items = Informational; meetings = Informational/Important; only Urgent for emergencies/deadlines <24h/safety; default Informational.
  - Summary must be concise, decision-focused, no headers/lists, `< 100 chars` if possible.

### Normalized response shape
```ts
{
  actions: string[],
  deadlines: string[],
  urgency: "Urgent" | "Important" | "Informational",
  confusingParts: { sentence: string, explanation: string }[],
  nextStep: string,
  summary: string
}
```

### Multi-key failover
- Keys: `process.env.OPENROUTER_API_KEY1|2|3` (empty filtered out).
- `isRetryableError()`: message includes `credit/quota/rate limit/exhausted/insufficient`, code `insufficient_credits`/`rate_limit_exceeded`, or status `429`/`402`.
- Failed keys get flagged `isExhausted`/`isRateLimited` in `keyStatuses` (in-memory) and skipped in subsequent attempts.
- If no active keys remain → `throw createError('All OpenRouter API keys are exhausted or rate limited...', 'ALL_KEYS_EXHAUSTED', true)`.

---

## Step 5 — Rule-based fallback

File: `src/app/actions/analyzeText.ts` — `analyzeWithRules(input)`

1. `cleanText` + `enhanceInput`.
2. Split sentences via `split(/(?<=[.!?])\s+/)`; filter:
   - length > 20,
   - not `^to/from/re/date :` headers,
   - not containing `office of the` / `memorandum`.
3. **Actions:** match `ACTION_VERBS`; special-case suspension sentences → hardcoded Bulan municipality action; lost-and-found instruction → `"If you find the item, bring it to the Lost and Found office"`.
4. **Deadlines:** match `DEADLINE_REGEX`.
5. **Confusing parts:** sentence length > 150 or contains `subject to`/`accordingly`.
6. **Urgency:** lost/found → Informational; keywords or `tropical cyclone`/`heavy rainfall` → Urgent; else if deadlines → Important; else Informational.
7. **Next step:** first action, or contextual lost/found/default messages.
8. **Summary:** `generateDecisionFocusedSummary()` — decision/reason/timeframe detection, lost-item and found-item special cases.
9. `highlightImportantPhrases()` wraps phrases like `"suspension of face-to-face classes"`, `"until lifted"`, `"tropical cyclone"`, `"heavy rainfall"` in `<mark style="background:#fde68a;...">`.

---

## Step 6 — Rendering

File: `src/components/main-input-area/page.tsx`

- **Status chips** (file name, char count, "Analysis ready") in the input header.
- **Results card** (only when `result` truthy):
  - Urgency pill (blue).
  - Actions list (blue dots).
  - Deadlines list (purple dots).
  - `<ConfusingParts data={result.confusingParts} />` if any.
  - Next Step box (blue).
  - Summary box (green) with AI/Basic badge; rendered via `dangerouslySetInnerHTML` (since summary may contain `<mark>`).
  - `Retry AI` button shown when `analysisMethod === "fallback"` → re-invokes `analyzeText(text)`.
  - Close results button.
- **Translation:** `<TranslatedResult result={result} />`.
- **Ads:** `<AdsContainer showAd={!!result} />`.

---

## Data-flow invariants / edge cases

| Case | Behavior |
|------|----------|
| Input `< 10` chars after enhance | Throws `INPUT_TOO_SHORT`; UI shows alert with message |
| All keys exhausted | Throws `ALL_KEYS_EXHAUSTED` (retryable) — UI shows error |
| Non-retryable OpenRouter error | Falls back to rules |
| Weak/missing summary from AI | `validateAndNormalizeResponse` warns; fallback summary logic exists but only used in rules path |
| Batch mode | Per-item try AI → fallback rules; never throws |

---

## Suggested technical enhancements

1. **Streaming:** consider streaming the OpenRouter response to show partial results (needs server action change → maybe a route handler with `ReadableStream`).
2. **Timeout:** add a hard timeout around `fetch` (AbortController) to bound worst-case latency.
3. **Cache:** cache normalized results by input hash (LRU) to reduce API cost.
4. **Telemetry:** log `analysisMethod` split (ai vs fallback), latency, and key-rotation events.
5. **Summary sanitization:** since summary uses `dangerouslySetInnerHTML`, ensure `<mark>` is the only allowed tag or use a proper sanitizer (e.g., `sanitize-html`) for safety.

