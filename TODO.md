# Task Completion Plan: Update Header/Footer Text to "TaskMind" & Fix Logo

## Steps:
- [x] 1. Analyzed files with search_files and read relevant components/layout/page/public/file.svg
- [x] 2. Update src/components/header/page.tsx (text & logo)
- [x] 3. Update src/components/Footer.tsx (text & logo)
- [x] 4. Created TODO.md for tracking
- [ ] 5. Verify changes and complete task

**TaskMind (formerly ActionClarity / “What Should I Do”)** is an AI-powered productivity web application that turns confusing messages, emails, announcements, memos, notices, or documents into clear, structured, actionable items.

**Live demo:** [https://taskmind.ai](https://taskmind.ai)  
**Repository:** [https://github.com/jobelGolde12/what_should_i_do](https://github.com/jobelGolde12/what_should_i_do)

It is **not** a generic summarizer or chatbot. It is a **decision & action clarity tool** focused on extracting what you actually need to *do*, when, how urgent it is, and what is still unclear.

---

### Project Overview

| Aspect | Details |
|--------|---------|
| **Name** | TaskMind |
| **Purpose** | Transform messy text into structured actions, deadlines, urgency levels, confusing parts, a single next-step recommendation, and a concise summary |
| **Tech Stack** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 4, OpenRouter API (Claude 3.5 Sonnet), client-side file parsing (PDF, DOCX, images via OCR) |
| **Privacy Model** | Server-side LLM calls via OpenRouter (with multi-key failover). No user accounts required for core use. Ads are present. |
| **Deployment** | Vercel (live demo) |
| **License** | MIT (per README) |
| **Target Users** | Students, professionals, everyday people dealing with official notices, emails, group messages, government/barangay announcements, etc. |

---

### Core Features

1. **Action Extractor**  
   Detects action verbs (submit, attend, pay, respond, bring, register, etc.) and converts them into clear, checklist-style action items.

2. **Deadline Detector**  
   Turns vague references (“by EOD”, “next Friday”, “end of month”, “tomorrow at 10 AM”) into concrete dates/times with visual indicators.

3. **Urgency Classifier**  
   Color-coded levels:
   - 🟢 Low / Informational
   - 🟡 Medium / Important
   - 🔴 High / Urgent

4. **Confusion Highlighter**  
   Identifies ambiguous or incomplete sentences and explains *why* they are confusing in plain language.

5. **One-Sentence Guidance (“Next Step”)**  
   A single prioritized recommendation: “If you do only one thing, do this.”

6. **Multilingual Translation**  
   One-click translation of the full analysis results (starting with Tagalog/Filipino, with support for others).

7. **File Upload & Extraction**  
   - Plain text (.txt)
   - PDF (via pdfjs-dist)
   - DOCX (via mammoth)
   - Images (OCR via Tesseract.js)

8. **Robust AI Backend with Fallback**  
   - Primary: OpenRouter API using `anthropic/claude-3.5-sonnet`
   - Automatic key rotation across up to 3 API keys (`OPENROUTER_API_KEY1/2/3`)
   - Handles credit exhaustion, rate limits (429/402), and network errors
   - Rule-based fallback analysis when all AI keys fail (keyword + regex based)

9. **Other UX Features**  
   - Clear All functionality
   - Character/file status indicators
   - Google AdSense integration
   - SEO-optimized (structured data, Open Graph, Twitter cards, sitemap)
   - Mobile-friendly responsive design
   - No login required for core analysis

---

### Pages & Application Structure

**Main Routes (Next.js App Router under `src/app/`):**

| Route | Description |
|-------|-------------|
| `/` (page.tsx) | Landing page – Hero section + main input area + features explanation + footer. Primary user experience. |
| `/dashboard` | Placeholder page (“Dashboard Page”). Currently minimal/stub. |
| `/auth/*` | Authentication-related routes (present in folder structure). |
| `/api/summarize` | API route for summarization/analysis. |
| `/api/debug` | Debug endpoints. |
| `/api/users` | User-related API (likely for future expansion). |
| `sitemap.ts` | Dynamic sitemap generation. |

**Key Components (`src/components/`):**

- `header/` – Site navigation/header
- `hero-section/` – Marketing hero
- `main-input-area/` – Core UI: textarea, file upload, Analyze button, results display
- `ConfusingParts/` – Renders confusing sentences + explanations
- `TranslatedResult/` – Handles translation UI
- `HowItWorks/` – Explains the 3-step process
- `AdsContainer/` – Shows ads after results appear
- `Footer.tsx` – Site footer

**Core Library (`src/lib/`):**

- `openrouter.ts` – Full OpenRouter client with multi-key failover, input normalization, response validation, and JSON-mode prompting
- `errors.ts` – Centralized error creation and messaging

**Server Actions:**

- `src/app/actions/analyzeText` – Main analysis entry point (calls OpenRouter → falls back to rules)

---

### How It Works (Technical Flow)

1. User pastes text or uploads a file (TXT/PDF/DOCX/image).
2. Client extracts text (if needed) using pdfjs-dist, mammoth, or Tesseract.js.
3. Text is sent to the `analyzeText` server action.
4. `OpenRouterAPI.analyzeText()`:
   - Normalizes input (whitespace, non-ASCII cleanup).
   - Sends a carefully engineered system prompt + user message to Claude 3.5 Sonnet (JSON mode).
   - Tries keys in order with automatic failover on credit/rate-limit errors.
   - Validates and normalizes the JSON response into a consistent shape:
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
5. On total AI failure → rule-based fallback (keyword matching for actions + regex for deadlines/urgency).
6. Results are rendered with urgency badges, lists, confusing-parts explanations, next-step highlight, and optional translation.

---

### Example

**Input:**
> “Hi team, just a reminder that the final project needs to be submitted via the online portal by Friday. Also, don’t forget about the mandatory presentation tomorrow at 10 AM. Late submissions might have penalties but I need to check the exact rules. See you tomorrow!”

**Output structure (English):**
- **ACTIONS**: Submit final project via online portal; Attend mandatory project presentation
- **DEADLINES**: Today – Project presentation at 10:00 AM; Friday – Final submission
- **CONFUSING PARTS**: Exact penalties for late submission not specified; Presentation duration/grading criteria unclear
- **URGENCY**: Urgent
- **NEXT STEP**: Prepare for tomorrow’s presentation and submit the final project before Friday
- **SUMMARY**: Immediate action required due to tight deadlines and upcoming presentation

Plus one-click translation (e.g., to Tagalog).

---

### Tech Stack Details

**Dependencies (from package.json):**
- Next.js ~14.2, React 18, TypeScript
- Tailwind CSS 4 + PostCSS
- `@xenova/transformers`, `node-summarizer` (legacy/secondary)
- `mammoth` (DOCX), `pdfjs-dist` (PDF), `tesseract.js` (OCR)
- `lucide-react` (icons)

**Environment Variables:**
- `OPENROUTER_API_KEY1` (required)
- `OPENROUTER_API_KEY2` / `OPENROUTER_API_KEY3` (failover)
- `NEXT_PUBLIC_APP_URL` (optional, for OpenRouter headers)

**Scripts:**
```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

---

### Installation & Local Development

```bash
git clone https://github.com/jobelGolde12/what_should_i_do.git
cd what_should_i_do
npm install

# Create .env.local
OPENROUTER_API_KEY1=sk-or-v1-...
OPENROUTER_API_KEY2=sk-or-v1-...   # optional
OPENROUTER_API_KEY3=sk-or-v1-...   # optional

npm run dev
# Open http://localhost:3000
```

---

### Current Status & TODO / Roadmap Insights

From the repository’s `TODO.md` and code:

- WebLLM (original client-side approach mentioned in README) has been **fully replaced** by OpenRouter.
- Strong focus on resilience (multi-key rotation + rule-based fallback).
- Dashboard and auth routes exist but are largely stubs.
- Planned/ongoing improvements: better handling of messy/informal input, improved prompt engineering, more languages, UI polish, and production hardening.

There is also internal troubleshooting documentation (`docs/analyze-results-not-working.md`) covering API key issues, rate limits, short text, network problems, and the fallback system.

---

### Who It’s For

- **Students** – School announcements, thesis guidelines, group project messages
- **Professionals** – Manager emails, HR notices, meeting invites, project requirements
- **Everyday users** – Bills, government/barangay notices, long chat messages, contracts

---

### Contributing & Support

Standard GitHub flow (fork → feature branch → PR). Suggested areas: new models, better deadline detection, additional languages, UI/UX, documentation, and examples.

- Issues / Discussions: GitHub repository
- Live demo for testing: [taskmind.ai](https://taskmind.ai)

---

This documentation is compiled from the repository README, source structure (`src/app`, `src/components`, `src/lib`), live site, package.json, TODO.md, and internal docs as of the latest available state. The project is actively evolving from a privacy-focused WebLLM vision toward a more reliable OpenRouter-backed production tool while keeping the core “clarity over summarization” philosophy.