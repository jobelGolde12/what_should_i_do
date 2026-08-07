# Pages & Application Structure — Detailed Plan

This document maps the full application structure so future enhancements know exactly where code lives.

---

## Main Routes (Next.js App Router under `src/app/`)

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing page — Hero section + main input area + features explanation + footer. Primary user experience. |
| `/dashboard` | `src/app/dashboard/page.tsx` | Placeholder page ("Dashboard Page"). Currently minimal/stub. |
| `/auth/login` | `src/app/auth/login/page.tsx` | Login page (stub). |
| `/auth/register` | `src/app/auth/register/page.tsx` | Register page (stub). |
| `/api/summarize` | `src/app/api/summarize/route.ts` | API route for summarization/analysis. |
| `/api/debug/openrouter` | `src/app/api/debug/openrouter/route.ts` | Debug endpoint for OpenRouter key status. |
| `/api/debug/server-action` | `src/app/api/debug/server-action/route.ts` | Debug endpoint to test the server action path. |
| `/api/users` | `src/app/api/users/route.ts` | User-related API (likely for future expansion). |
| `sitemap.ts` | `src/app/sitemap.ts` | Dynamic sitemap generation (currently single URL: `https://whatshouldido-five.vercel.app/`). |

### Layout & Global
| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout: Inter font, `metadata.title = "TaskMind"`, global CSS import. |
| `src/app/globals.css` | Global styles + Tailwind v4 (`@import "tailwindcss"` etc.). |
| `src/app/favicon.ico` | Site favicon used by header/footer logos. |

---

## Key Components (`src/components/`)

| Component | Path | Role |
|-----------|------|------|
| `header/` | `src/components/header/page.tsx` | Site navigation/header. Sticky, white/backdrop-blur, logo + "TaskMind" + nav links ("How it works", "Features") + "Try Now" CTA. |
| `hero-section/` | `src/components/hero-section/page.tsx` | Marketing hero: headline, CTA, 3-step process, `MainInputArea`, `HowItWorks`, Features grid, "Who Uses This Tool", final CTA. |
| `main-input-area/` | `src/components/main-input-area/page.tsx` | Core UI ("use client"): textarea, file upload (TXT/PDF/DOCX/image OCR), Analyze button, status chips, Clear All, results display (urgency/actions/deadlines/confusing parts/next step/summary), AdsContainer trigger, TranslatedResult. |
| `ConfusingParts/` | `src/components/ConfusingParts/page.tsx` | Renders confusing sentences + explanations. |
| `TranslatedResult/` | `src/components/TranslatedResult/page.tsx` | Handles translation UI (one-click translation of analysis results). |
| `HowItWorks/` | `src/components/HowItWorks/page.tsx` | Explains the 3-step process / example output. |
| `AdsContainer/` | `src/components/AdsContainer/page.tsx` | Shows ads after results appear (`showAd` prop). |
| `Footer.tsx` | `src/components/Footer.tsx` | Site footer: logo + "TaskMind" + tagline "Clear actions from confusing messages." + subtitle "A Universal Instruction Translator"; social icons block currently commented out. |

---

## Core Library (`src/lib/`)

| File | Role |
|------|------|
| `openrouter.ts` | Full OpenRouter client: multi-key failover (`OPENROUTER_API_KEY1/2/3`), input normalization, JSON-mode prompting, response validation/normalization, `anthropic/claude-3.5-sonnet` model. Exports singleton `openRouterAPI`. |
| `errors.ts` | Centralized error creation and messaging: `AnalysisError`, `ERROR_CODES`, `createError()`, `getErrorMessage()`, `isRetryableError()`. |

---

## Server Actions (`src/app/actions/`)

| File | Role |
|------|------|
| `analyzeText.ts` | Main analysis entry point. Exports: `analyzeText()`, `analyzeTextFast()`, `analyzeTextsBatch()`. Flow: `cleanText()` → `enhanceInput()` → OpenRouter (primary) → `analyzeWithRules()` (fallback). Also contains `ACTION_VERBS`, `URGENT_KEYWORDS`, `DEADLINE_REGEX`, `generateDecisionFocusedSummary()`, `highlightImportantPhrases()`, `AnalysisResult` type. |

---

## Types

| File | Role |
|------|------|
| `types/node-summarizer.d.ts` | Type declaration for `node-summarizer` (legacy/secondary dependency). |

---

## Configuration Files (root)

| File | Purpose |
|------|---------|
| `package.json` | Scripts + dependencies (see `07-tech-stack-details.md`). |
| `next.config.js` | Next.js config. |
| `tailwind.config.js` | Tailwind config (Tailwind CSS v4 + PostCSS). |
| `postcss.config.js` / `postcss.config.mjs` | PostCSS config. |
| `eslint.config.mjs` | ESLint flat config. |
| `tsconfig.json` | TypeScript config. |
| `.env.local` | Local environment variables (contains `OPENROUTER_API_KEY1` etc.). |

---

## Enhancement Opportunities per Area

1. **`/dashboard`** — Currently a stub; plan a real dashboard (history of past analyses, saved results, premium/ads toggle).
2. **`/auth/*`** — Stubs; decide whether to keep no-login core or build optional accounts for history sync.
3. **`api/users`** — Expand if accounts are introduced.
4. **`sitemap.ts`** — Add more URLs (feature pages, docs) and align domain with final TaskMind branding.
5. **`TranslatedResult`** — Document the translation backend and expand language coverage.
6. **`Footer`** — Restore social links (GitHub, X, LinkedIn) with real URLs + copyright line.
7. **`AdsContainer`** — Ensure ads only render on production and don't break layout on mobile.

