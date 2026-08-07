# Installation & Local Development — Detailed Plan

Step-by-step guide to run TaskMind locally, including prerequisites, environment setup, and troubleshooting.

---

## Prerequisites

- **Node.js** `>= 18.0.0` (per README). Recommended: Node 18 LTS or 20 LTS.
- **npm** (or `yarn`/`pnpm` — commands below use `npm`).
- A code editor (VSCode recommended).
- (Optional but recommended) An OpenRouter API key: sign up at https://openrouter.ai and create a key.

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/jobelGolde12/what_should_i_do.git
cd what_should_i_do

# 2. Install dependencies
npm install
```

---

## Environment Setup

Create `.env.local` in the project root (git-ignored; never commit):

```bash
# Required
OPENROUTER_API_KEY1=sk-or-v1-...

# Optional failover keys
OPENROUTER_API_KEY2=sk-or-v1-...
OPENROUTER_API_KEY3=sk-or-v1-...

# Optional: used for the HTTP-Referer header sent to OpenRouter
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> The `.env.local` file already exists in the repo (locally), containing the real keys. Do **not** commit it.

---

## Run the Development Server

```bash
npm run dev
# Open http://localhost:3000
```

### What to expect
- Landing page (`/`) with header (TaskMind), hero, main input area, features, footer.
- Pasting text and clicking **Analyze Text** invokes the `analyzeText` server action.
- If OpenRouter keys are valid → AI analysis ("AI Analysis" badge).
- If all keys fail → rule-based fallback ("Basic Analysis" badge + "Retry AI" button).

---

## Other Commands

```bash
npm run build    # Production build — catches type/compile errors
npm start        # Serve the production build
npm run lint     # Run ESLint
```

---

## Useful Debug Endpoints (dev only)

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:3000/api/debug/openrouter` | Shows OpenRouter key statuses / failover state |
| `http://localhost:3000/api/debug/server-action` | Tests the server action path directly |
| `http://localhost:3000/api/summarize` | Legacy summarization API route |
| `http://localhost:3000/api/users` | User API stub |

---

## Testing Checklist

1. **Basic text analysis** — paste a normal message, confirm all six sections render.
2. **Messy / OCR-like text** — paste text with typos (`t0day`, `pls`, `w/`) and confirm `enhanceInput()` normalizes it.
3. **Class-suspension announcement** — confirm the fallback special-case action appears.
4. **File uploads** — test TXT, PDF, DOCX, and a JPG/PNG image (OCR).
5. **Translation** — click translate and confirm Tagalog output.
6. **Fallback** — temporarily remove/invalidate keys, confirm Basic Analysis + Retry AI.
7. **Build** — `npm run build` passes with no errors.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "No OpenRouter API keys configured" | `.env.local` missing/empty keys | Add `OPENROUTER_API_KEY1`; restart `npm run dev` |
| "All OpenRouter API keys are exhausted or rate limited" | Credits depleted / rate limit | Check https://openrouter.ai/activity; add failover keys or wait |
| "Invalid JSON response from OpenRouter" | Model returned non-JSON | Retry; occasionally happens — the server action will fall back to rules |
| PDF worker not loading | CDN mismatch with `pdfjs-dist` version | Verify `pdfjsLib.version` matches `pdf.worker.min.js` URL |
| OCR gives poor results | Low-quality image / non-English text | Use clearer image; `tesseract.js` is configured for English (`"eng"`) |
| "Text too short" | Input `< 10` chars after enhance | Paste more content |
| Port 3000 in use | Another dev server | Set a different port, e.g. `npm run dev -- -p 3001` |
| `npm run build` fails on types | `@types/react` v19 vs React 18 mismatch | Align type versions (see `07-tech-stack-details.md`) |

See also `docs/analyze-results-not-working.md` for deeper API-key / rate-limit / network debugging.

