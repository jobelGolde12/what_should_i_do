# Feature 07 — Multilingual Translation

> **Status: DONE** — Translation now runs through a server-side proxy `src/app/api/translate/route.ts`: in-memory cache keyed by `(textHash, targetLang)` with TTL + size cap, per-chunk timeouts via `AbortController`, server-side chunking (≤480 chars), and proper error responses. `TranslationBlock` posts to the proxy (single request, no external API exposure) and the result region is `aria-live="polite"`. Verified working end-to-end (Filipino) with cache hit on repeat call.

## 1. What it is & its role

The **Multilingual Translation** feature lets users translate the analysis **summary** into multiple languages with one click. It supports English, Filipino, Spanish, French, German, Italian, and Portuguese. Its role is to make the action clarity tool accessible to non-English speakers (a core audience segment, especially Filipino users).

## 2. Current functionality

### Where it lives
- **UI:** `src/components/results/TranslationBlock.tsx`.
- **Provider:** The free **MyMemory** public translation API (`https://api.mymemory.translated.net/get`).
- **Integration:** `ResultsPanel.tsx` renders `<TranslationBlock summary={...} />` in the Summary section.

### How it works today
1. User expands the "Translate summary" accordion.
2. User picks a target language.
3. The summary is stripped of HTML tags, split into chunks (≤480 chars), and each chunk is sent to MyMemory in sequence.
4. Translated chunks are joined and displayed.
5. Selecting "English" resets to the original.

### Current limitations
- **Relies on a free, rate-limited third-party API** with no server-side proxy, no key, and no fallback — unreliable and can fail or return low-quality results.
- **Only the summary** is translated — not actions, deadlines, next-step, or confusing parts.
- **No language auto-detection** and no Filipino-first tuning.
- No caching of translations.
- No error handling beyond a generic message.
- No offline/fallback dictionary for common terms.
- Accessibility: translated text is not announced to screen readers on completion.

## 3. Future enhancements (production-ready Multilingual Translation)

### 3.1 Server-side translation proxy
- Move translation calls to a server route (`/api/translate`) to:
  - Hide/protect any API key.
  - Add caching (in-memory or Redis) keyed by `textHash + targetLang`.
  - Add rate limiting and provider failover (MyMemory → LibreTranslate → Google Cloud Translation).
  - Add timeouts and retries.

### 3.2 Translate the full analysis
- Translate **all** fields (actions, deadlines, nextStep, confusingParts, summary, urgency label) so the entire result is language-consistent.
- Add a per-language "view translated analysis" mode.

### 3.3 Language auto-detection
- Detect the source language and offer "translate to English" when the input is non-English.
- Add Filipino/English as priority languages with tuned prompts.

### 3.4 Glossary & terminology
- Maintain a glossary for domain terms (deadline, urgency, next step) so translations are consistent.

### 3.5 Accessibility
- Use `aria-live="polite"` so translations are announced when they complete.
- Add loading progress and cancel for long texts.

### 3.6 Testing
- Unit tests for chunking logic.
- Integration tests with a mocked translation provider.
- Snapshot tests for language buttons and states.

> **Definition of "done" for this feature:** Translation is server-proxied, cached, provider-failover, covers the full analysis, auto-detects language, is accessible, and is fully tested.
