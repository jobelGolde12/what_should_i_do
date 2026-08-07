# Core Features — Detailed Enhancement Plan

All features below are implemented in the current codebase. This document expands each one with implementation details, current code locations, and suggested enhancements.

---

## 1. Action Extractor

**What it does:** Detects action verbs (submit, attend, pay, respond, bring, register, etc.) and converts them into clear, checklist-style action items.

**Current implementation:**
- **AI path:** `src/app/actions/analyzeText.ts` → `analyzeWithOpenRouter()` calls `openRouterAPI.analyzeText()`. The OpenRouter system prompt (`src/lib/openrouter.ts`) instructs the model to return `actions: string[]`.
- **Fallback path:** `analyzeWithRules()` in `src/app/actions/analyzeText.ts` uses the `ACTION_VERBS` constant:
  ```ts
  const ACTION_VERBS = [
    "submit", "attend", "pay", "respond", "bring",
    "fill out", "register", "watch", "send", "reply"
  ];
  ```
  Each sentence containing one of these verbs (and not classified as a lost-item/found-instruction sentence) is pushed as an action.
- **Special rule:** For class-suspension announcements, a hardcoded action is generated:
  `"Suspend face-to-face classes at all levels within the Municipality of Bulan."`

**Suggested enhancements:**
- Expand `ACTION_VERBS` with domain-specific verbs (e.g., "acknowledge", "confirm", "update", "upload", "submit" variants).
- Add a normalization pass so duplicate/imperative forms are collapsed.
- Let the AI path return actions as objects (`{ text, type }`) to enable grouping in the UI.

---

## 2. Deadline Detector

**What it does:** Turns vague references ("by EOD", "next Friday", "end of month", "tomorrow at 10 AM") into concrete dates/times with visual indicators.

**Current implementation:**
- **AI path:** Model returns `deadlines: string[]` via the OpenRouter prompt.
- **Fallback path:** `DEADLINE_REGEX` in `src/app/actions/analyzeText.ts`:
  ```ts
  const DEADLINE_REGEX =
    /\b(today|tomorrow|until lifted|effective\s+\d{1,2}:\d{2}|\bnovember\s+\d{1,2},\s*\d{4})\b/i;
  ```
- Results are rendered as a bulleted list with purple dots in `src/components/main-input-area/page.tsx`.

**Suggested enhancements:**
- Parse *relative* expressions ("next Friday", "EOD") into actual dates using a date library or a new `parseDeadline()` helper.
- Return structured deadlines `{ raw, parsedDate, isRelative }` and render visual calendar badges.
- Expand the regex to cover more languages/patterns (Philippine context: "until lifted", "effective 5:00").

---

## 3. Urgency Classifier

**What it does:** Color-coded levels:
- 🟢 Low / Informational
- 🟡 Medium / Important
- 🔴 High / Urgent

**Current implementation:**
- **AI path:** Prompt in `src/lib/openrouter.ts` has critical rules:
  - Lost item notices → `Informational` (not urgent).
  - Meeting invitations → `Informational` or `Important`.
  - Only `Urgent` for actual emergencies, deadlines within 24h, safety alerts.
  - Default to `Informational` if unclear.
- **Fallback path:** `analyzeWithRules()` in `src/app/actions/analyzeText.ts`:
  - Lost/found items → `Informational`.
  - `URGENT_KEYWORDS` (`today`, `immediately`, `asap`, `urgent`, `final notice`, `effective`, `until lifted`) or `tropical cyclone` / `heavy rainfall` → `Urgent`.
  - Otherwise if deadlines exist → `Important`.
- **UI:** `src/components/main-input-area/page.tsx` renders the urgency as a single blue pill badge (not yet color-coded per level).

**Suggested enhancements:**
- Map urgency to real colors in the UI: green pill for Informational, yellow/amber for Important, red for Urgent.
- Add the urgency legend (🟢🟡🔴) to the hero or results section.
- Consider a "confidence" field when the AI infers urgency from ambiguous text.

---

## 4. Confusion Highlighter

**What it does:** Identifies ambiguous or incomplete sentences and explains *why* they are confusing in plain language.

**Current implementation:**
- **AI path:** Model returns `confusingParts: [{ sentence, explanation }]`.
- **Fallback path:** In `analyzeWithRules()`:
  - Sentences longer than 150 chars, or containing "subject to" / "accordingly" are flagged.
  - Explanation: `"This sentence is long or complex and may require simplification."`
- **UI:** `src/components/ConfusingParts/page.tsx` renders the list of confusing sentences with explanations.

**Suggested enhancements:**
- Add heuristic triggers for vague qualifiers ("probably", "maybe", "might", "TBD", "I think").
- Allow users to click a confusing sentence to see the original surrounding context.
- Provide "Ask for clarification" draft reply suggestions generated from the explanation.

---

## 5. One-Sentence Guidance ("Next Step")

**What it does:** A single prioritized recommendation: "If you do only one thing, do this."

**Current implementation:**
- **AI path:** Model returns `nextStep: string`.
- **Fallback path:** `nextStep` defaults to the first action, or contextual messages:
  - Lost item → `"Check if you found the item and contact the Lost and Found office"`.
  - Found item → `"No action required unless you found the item"`.
  - Default → `"No immediate action required."`.
- **UI:** Rendered in a highlighted blue box in `src/components/main-input-area/page.tsx`:
  ```tsx
  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
    <strong className="text-blue-700">Next Step:</strong>
    <p className="mt-2 font-semibold text-gray-800">{result.nextStep}</p>
  </div>
  ```

**Suggested enhancements:**
- Add a one-click "Copy next step" button.
- Optionally generate a calendar/reminder link (e.g., `https://calendar.google.com/calendar/render?...`) from the deadline + next step.

---

## 6. Multilingual Translation

**What it does:** One-click translation of the full analysis results (starting with Tagalog/Filipino, with support for others).

**Current implementation:**
- `src/components/TranslatedResult/page.tsx` handles the translation UI.
- The hero section markets "Translate to any Language".

**Suggested enhancements (review needed against `TranslatedResult` internals):**
- Verify which translation backend is used (browser API vs server route) and document it here.
- Expand to additional languages (Cebuano, Ilocano, Spanish).
- Add translation memory / caching to avoid duplicate calls for the same result.
- Show a "Translated" badge with target language name.

---

## 7. File Upload & Extraction

**What it does:** Accepts text files, PDFs, DOCX documents, and images (OCR).

**Current implementation** (`src/components/main-input-area/page.tsx`, `handleFileUpload`):

| Type | Parser | Notes |
|------|--------|-------|
| Plain text (`.txt`) | `file.text()` | Direct read |
| PDF | `pdfjs-dist` (dynamic import) | Worker loaded from CDN: `pdf.worker.min.js` matching installed version; iterates pages and joins text items |
| DOCX | `mammoth.extractRawText` | `{ arrayBuffer }` input |
| Images (JPG/PNG) | `tesseract.js` | `Tesseract.recognize(file, "eng", { logger: () => {} })` |

**Suggested enhancements:**
- Handle scanned PDFs by falling back to OCR when `getTextContent()` returns empty.
- Add drag & drop support for files.
- Add a file-size limit warning (currently none enforced client-side).
- Support `.doc` (legacy) via a converter or show a friendly error.

---

## 8. Robust AI Backend with Fallback

**What it does:**
- **Primary:** OpenRouter API using `anthropic/claude-3.5-sonnet`.
- **Automatic key rotation** across up to 3 API keys (`OPENROUTER_API_KEY1/2/3`).
- Handles credit exhaustion, rate limits (429/402), and network errors.
- **Rule-based fallback** analysis when all AI keys fail (keyword + regex based).

**Current implementation** (`src/lib/openrouter.ts`):
- `API_KEYS` array built from env vars, filtered for empty values.
- `makeRequest()` POSTs to `https://openrouter.ai/api/v1/chat/completions` with:
  - `HTTP-Referer` = `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`
  - `X-Title` = `'TaskMind - Text Analysis'`
  - `temperature: 0.1`, `max_tokens: 900`, `response_format: { type: 'json_object' }`
- `isRetryableError()` returns true for credit/quota/rate-limit/insufficient codes, `429`, `402`.
- `analyzeText()` iterates keys, skips exhausted/rate-limited ones, returns `validateAndNormalizeResponse(parsed)`.
- On total failure throws `ALL_KEYS_EXHAUSTED` (if no active keys) or a generic error.
- `validateAndNormalizeResponse()` enforces the shape:
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
- **Fallback:** `analyzeWithRules()` in `src/app/actions/analyzeText.ts` (keyword + regex).

**Error handling** (`src/lib/errors.ts`):
- `AnalysisError` with `message`, `code`, `retryable`.
- `ERROR_CODES`: `INPUT_TOO_SHORT`, `API_KEY_EXHAUSTED`, `ALL_KEYS_EXHAUSTED`, `RATE_LIMITED`, `NETWORK_ERROR`, `INVALID_RESPONSE`, `TEXT_TOO_LONG`, `INVALID_JSON`, `UNKNOWN_ERROR`.
- Helpers: `createError()`, `getErrorMessage()`, `isRetryableError()`.

**Suggested enhancements:**
- Add per-key cooldown/backoff (currently just skips keys marked exhausted/rate-limited for the session).
- Expose a `/api/debug/openrouter` health check for key statuses (route already exists at `src/app/api/debug/openrouter/route.ts`).
- Consider adding a secondary model (e.g., a smaller/cheaper model) before falling back to rules.
- Persist key statuses across requests (currently in-memory on the server instance).

---

## 9. Other UX Features

| Feature | Status | Details / Location |
|---------|--------|--------------------|
| Clear All functionality | ✅ Implemented | `handleClearAll()` in `src/components/main-input-area/page.tsx`; clears text, result, uploaded file name, and the file input value |
| Character/file status indicators | ✅ Implemented | Chips in the input header showing uploaded file name, character count, and "Analysis ready" state |
| Google AdSense integration | ✅ Implemented | `<Script>` from `pagead2.googlesyndication.com` in `src/app/page.tsx`; `src/components/AdsContainer/page.tsx` shows ads after results appear (`showAd={!!result}`) |
| SEO-optimized | ✅ Implemented | Structured data (WebApplication + ItemList) in `src/app/page.tsx`; Open Graph + Twitter cards + themeColor + canonical; `src/app/sitemap.ts` |
| Mobile-friendly responsive design | ✅ Implemented | Tailwind responsive classes throughout; sticky header; collapsible nav links (`hidden md:inline-block`) |
| No login required for core analysis | ✅ Implemented | `src/app/auth/*` exists but is not wired into the core flow |

**Suggested enhancements:**
- Add a "Regenerate" (Retry AI) button is already present when `analysisMethod === "fallback"` — consider exposing it always.
- Add local storage so users don't lose pasted text on refresh.
- Add copy-to-clipboard for the entire analysis result.

