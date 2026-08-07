# Current Status & Roadmap — Detailed Plan

This document captures the current state of the project and the roadmap insights gathered from the codebase, `TODO.md`, and README, with actionable enhancement items.

---

## Current Status Summary

| Area | Status | Evidence |
|------|--------|----------|
| Branding (header/footer/metadata) | ✅ Mostly done | Header/Footer show "TaskMind"; `layout.tsx` title = "TaskMind"; OpenRouter `X-Title` = "TaskMind - Text Analysis" |
| Branding (README, URLs) | ⚠️ Stale | README still "ActionClarity"; `page.tsx` OG/canonical still `whatshouldido.app`; sitemap uses `whatshouldido-five.vercel.app` |
| AI backend | ✅ OpenRouter-backed | WebLLM approach fully replaced (per README history + `src/lib/openrouter.ts`) |
| Multi-key resilience | ✅ Implemented | `OPENROUTER_API_KEY1/2/3` rotation + `isRetryableError` handling |
| Rule-based fallback | ✅ Implemented | `analyzeWithRules()` in `src/app/actions/analyzeText.ts` |
| Dashboard | ⚠️ Stub | `src/app/dashboard/page.tsx` is a placeholder ("Dashboard Page") |
| Auth | ⚠️ Stub | `src/app/auth/login|register` exist but are not wired into core flow |
| Users API | ⚠️ Stub | `src/app/api/users/route.ts` minimal |
| Messy/informal input handling | ✅ In progress | `enhanceInput()` + OCR fixes + `cleanText()`; planned improvements remain |
| Translations | ✅ Basic | Tagalog via `TranslatedResult`; more languages planned |
| UI polish | ✅ Good baseline | Tailwind 4 responsive UI; improvements planned |
| Production hardening | ⚠️ Ongoing | Debug endpoints exist; monitoring/telemetry planned |

---

## Roadmap Insights (from code + docs)

### Completed / Replaced
- **WebLLM → OpenRouter:** The original client-side WebLLM approach (documented in README: Llama-2/Mistral models, `@xenova/transformers`, browser processing) has been **fully replaced** by server-side OpenRouter calls. The README is now misleading and should be rewritten to describe the OpenRouter architecture.
- **Header/Footer TaskMind rebrand:** Steps 1–4 of the root `TODO.md` are checked off; step 5 (verify + complete) remains.

### Known gaps & planned improvements
1. **Messy/informal input:** `enhanceInput()` handles OCR typos and slang but the OCR-fix dictionary is small — expand it and add multi-language normalization.
2. **Prompt engineering:** the system prompt in `openrouter.ts` is tuned for announcements/lost-and-found; add explicit examples per message type (meetings, invoices, government notices) and a few-shot approach.
3. **Deadline parsing:** fallback `DEADLINE_REGEX` is narrow; parse relative dates ("next Friday", "EOD", "end of month") into concrete dates with a date library.
4. **More languages:** translation currently starts with Tagalog; add Cebuano, Ilocano, Spanish, and more.
5. **UI polish:** map urgency to green/yellow/red badges; add loading skeletons; improve mobile nav; restore footer social links.
6. **Production hardening:**
   - Add request timeouts (AbortController) around OpenRouter fetch.
   - Add telemetry (analysisMethod split, latency, key-rotation events).
   - Sanitize summary HTML before `dangerouslySetInnerHTML`.
   - Move key statuses out of in-memory to a persistent store (or accept per-instance semantics on Vercel serverless).
   - Add rate limiting / abuse protection on the server action.
   - Align README + canonical/OG URLs + sitemap to final TaskMind domain.

---

## Suggested Roadmap Phases

### Phase 1 — Branding consistency (quick wins)
- [ ] Rewrite README.md to describe TaskMind + OpenRouter architecture (remove WebLLM-only content).
- [ ] Update canonical/OG/Twitter URLs in `src/app/page.tsx` to the final domain.
- [ ] Update `src/app/sitemap.ts` URLs.
- [ ] Confirm `public/favicon.ico` is a proper TaskMind logo asset.

### Phase 2 — Reliability & hardening
- [ ] Add fetch timeout + retry/backoff to `src/lib/openrouter.ts`.
- [ ] Sanitize AI-generated summary before rendering.
- [ ] Add error logging/monitoring (e.g., a lightweight `/api/debug/log` or external service).
- [ ] Expand `ERROR_CODES` handling in the UI (dedicated toast/alert components).

### Phase 3 — Feature depth
- [ ] Improve deadline detection (relative dates → concrete).
- [ ] Add more languages to translation.
- [ ] Expand `ACTION_VERBS` + confusion heuristics.
- [ ] Add results history (localStorage) and export (JSON/CSV/Markdown).

### Phase 4 — Product expansion
- [ ] Real dashboard (history, saved analyses, usage stats).
- [ ] Optional accounts (auth) for cross-device history.
- [ ] Premium tier (no ads, higher rate limits) — monetization.
- [ ] Multi-model support (model picker, cheaper fallback model before rules).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| OpenRouter key exhaustion / rate limits | Multi-key rotation + fallback rules; expose key status via debug endpoint; monitor at https://openrouter.ai/activity |
| Serverless cold-start latency | Keep bundle light; consider edge caching of prompts; add loading states |
| LLM JSON mode occasionally returns invalid JSON | `validateAndNormalizeResponse` + retry + rules fallback |
| `dangerouslySetInnerHTML` XSS surface | Sanitize summary; restrict `<mark>` tag or use `sanitize-html` |
| Dependency drift (`@types/react` 19 vs React 18) | Align versions during upgrades |
| Ads degrade UX | Lazy-load AdsContainer only after results; ad slot limits |

