# Tech Stack Details — Detailed Plan

This document enumerates the full technology stack, dependencies, environment variables, and npm scripts, with notes on each.

---

## Core Stack

| Layer | Technology | Version (from package.json) | Notes |
|-------|-----------|------------------------------|-------|
| Framework | Next.js | `^14.2.35` | App Router (`src/app/`), React Server Components + Server Actions |
| UI Library | React | `^18.2.0` | `react` / `react-dom` |
| Language | TypeScript | `^5` | `tsconfig.json` strict-ish setup |
| Styling | Tailwind CSS 4 | `^4` | via `@tailwindcss/postcss`, `postcss.config.*`, `tailwind.config.js` |
| Icons | `lucide-react` | `^0.562.0` | Used in hero, footer, input area |
| Fonts | `next/font/google` | — | Inter (in `layout.tsx` and `page.tsx`) |

---

## Dependencies (from package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `^14.2.35` | Framework |
| `react` / `react-dom` | `^18.2.0` | UI |
| `@xenova/transformers` | `^2.17.2` | Legacy/secondary (original WebLLM-adjacent client-side approach — see README history) |
| `node-summarizer` | `^1.0.7` | Legacy/secondary summarizer (types in `types/node-summarizer.d.ts`) |
| `mammoth` | `^1.11.0` | DOCX → text extraction (`src/components/main-input-area/page.tsx`) |
| `pdfjs-dist` | `^5.4.530` | PDF text extraction (worker loaded from CDN) |
| `tesseract.js` | `^7.0.0` | OCR for images |
| `lucide-react` | `^0.562.0` | Icons |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5` | Language |
| `@types/node` | `^20` | Node typings |
| `@types/react` / `@types/react-dom` | `^19` | React typings |
| `tailwindcss` | `^4` | Styling |
| `@tailwindcss/postcss` | `^4` | PostCSS plugin for Tailwind v4 |
| `postcss` | (via `postcss.config`) | CSS processing |
| `autoprefixer` | `^10.4.23` | Vendor prefixing |
| `eslint` | `^9` | Linting |
| `eslint-config-next` | `16.1.1` | Next.js ESLint preset |

> Note: `@types/react` `^19` with React `^18` — keep an eye on type compatibility when upgrading.

---

## External Services

### OpenRouter (AI backend)
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Model: `anthropic/claude-3.5-sonnet`
- JSON mode: `response_format: { type: "json_object" }`
- Headers: `HTTP-Referer` (from `NEXT_PUBLIC_APP_URL`), `X-Title: "TaskMind - Text Analysis"`
- See `src/lib/openrouter.ts` for the full client.

### Google AdSense
- Loaded via `<Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" strategy="afterInteractive">` in `src/app/page.tsx`.
- Ads container component: `src/components/AdsContainer/page.tsx`.

### PDF.js worker (CDN)
- `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
- Set in `handleFileUpload` inside `src/components/main-input-area/page.tsx`.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY1` | ✅ | Primary OpenRouter key |
| `OPENROUTER_API_KEY2` | ❌ | Failover key #2 |
| `OPENROUTER_API_KEY3` | ❌ | Failover key #3 |
| `NEXT_PUBLIC_APP_URL` | ❌ | Used for `HTTP-Referer` header (defaults to `http://localhost:3000`) |

Stored in `.env.local` (present at repo root, git-ignored).

---

## Scripts

```bash
npm run dev      # Development server (next dev)
npm run build    # Production build (next build)
npm start        # Production server (next start)
npm run lint     # ESLint (eslint)
```

---

## Build & Tooling Notes

- **Next.js config:** `next.config.js`
- **ESLint flat config:** `eslint.config.mjs`
- **PostCSS:** both `postcss.config.js` and `postcss.config.mjs` exist; verify which one is actually resolved by Next.js 14 to avoid confusion.
- **Tailwind v4:** uses `@import "tailwindcss"` in `globals.css` (v4 syntax), with `@tailwindcss/postcss` plugin.

---

## Suggested Stack Enhancements

1. **Add a date library** (e.g., `date-fns`) to improve deadline parsing in the fallback path.
2. **Add a sanitizer** (e.g., `sanitize-html`) for the summary `dangerouslySetInnerHTML` rendering.
3. **Add `openai` or keep raw `fetch`** — current raw `fetch` is fine and keeps deps light.
4. **Pin exact versions** in `package-lock.json` for reproducible CI builds (already locked).
5. **Evaluate `@types/react` v19 vs React 18 mismatch** — either align to v18 types or upgrade React.
6. **Consider removing legacy deps** (`@xenova/transformers`, `node-summarizer`) if unused to reduce bundle/surface area.

