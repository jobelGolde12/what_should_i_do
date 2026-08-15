# Build & Bundle Analysis — TaskMind

**Date:** 2026-08-15
**Command:** `npm run build` (Next.js 14.2.35 production build)
**Result:** ✅ Exit 0 — "Compiled successfully", 39 static pages generated, page optimization finalized.

---

## 1. Build summary

| Item | Value |
|---|---|
| Build status | ✅ Success (exit 0) |
| Compiled | Yes |
| Static pages generated | 39/39 |
| Prebuild hook | `scripts/self-host-assets.mjs` copies pdf.js + tesseract workers into `public/` (self-hosted, CSP-compatible) |
| Lint/typecheck pre-build | Clean (also run separately: 243 unit tests pass, typecheck clean, lint clean) |
| Warnings | `browserslist: caniuse-lite is outdated` (≈8 months stale) |

## 2. Route classification & sizes

**Static (○)** — prerendered at build time:

| Route | Size | First Load JS |
|---|---|---|
| `/` | 12.7 kB | 146 kB |
| `/inbox` | 11.5 kB | 108 kB |
| `/settings` | 9.57 kB | 126 kB |
| `/saved` | 4.66 kB | 121 kB |
| `/history` | 3.84 kB | 124 kB |
| `/actions` | 2.88 kB | 123 kB |
| `/auth/forgot-password` | 3.25 kB | 105 kB |
| `/auth/reset-password` | 3.56 kB | 105 kB |
| `/auth/verify` | 4.05 kB | 106 kB |
| `/auth/login` | 148 B | 107 kB |
| `/auth/register` | 148 B | 107 kB |
| `/dashboard` | 173 B | 87.9 kB |
| `/settings/billing` | 6.06 kB | 102 kB |
| `/privacy` | 156 B | 134 kB |
| `/terms` | 156 B | 134 kB |
| `/_not-found` | 173 B | 87.9 kB |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` | 0 B | 0 B |
| `/api/debug/env`, `/api/debug/health` | 0 B | 0 B | ← see note 2.1 |

**Dynamic (ƒ)** — server-rendered on demand: `/analysis/[id]` (3.04 kB / 136 kB), `/share/[id]` (1.97 kB / 140 kB), and all 34 API route handlers (0 B / 0 B).

Shared baseline: **First Load JS shared by all = 87.7 kB**.

### 2.1 Notable static/dynamic classifications
- All `/api/*` route handlers except two are dynamic (correct).
- **`/api/debug/env` and `/api/debug/health` are static (`○`)** — they were prerendered at build time. This is the root cause of BUG-08 (env permanently disabled in prod; health returns stale build-time state). See also SEC-06.
- Auth pages (`/auth/login`, `/auth/register`) are static shells (148 B) with the interactive form client-rendered — fine.

## 3. Bundle observations

- **Landing page `/` is the heaviest page** (146 kB First Load JS) — above the commonly-cited ~100 kB budget; driven by the shared app shell (87.7 kB) plus page bundle. Worth auditing for code-splitting (ads rail, analytics, framer-motion).
- `/analysis/[id]` (136 kB) and `/share/[id]` (140 kB) are near the same weight — these render the results views (results panel, reply panel, share view).
- Legal pages carry 134 kB First Load JS (≈156 B HTML) — the bulk is the shared shell; acceptable but a candidate for lazy shell separation if the shell grows.

## 4. Security headers emitted (production)
Verified via response headers on the production server:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy` and `Permissions-Policy` set
- HSTS + CSP **production-only** (`next.config.js`) — note: no HSTS in dev (expected).

## 5. Build-time findings affecting runtime
1. **Static debug endpoints** (BUG-08 / SEC-06) — see 2.1.
2. **caniuse-lite staleness** — update browserslist DB.
3. **Tailwind v4 `@theme` coverage gap** — utilities like `border-border`, `bg-card`, `bg-primary`, `ring-primary` used in `settings/billing/page.tsx` compile to nothing because `globals.css` defines no `--color-border/--color-card/--color-primary` tokens. This is a *styling* build issue with a *functional* UX impact (invisible plan indicator, dead focus ring). See UX-Review C1.
4. **Font config dead reference** — `tailwind.config.js` maps fonts to `var(--font-geist-*)` that are never defined (real fonts come from CSS `@theme`). Dead config only.

## 6. Recommendations
- Schedule the `next` 14 → 16 (+ react 18 → 19) major upgrade with the react/next pair and re-baseline these numbers (see dependency_scan).
- Re-baseline First Load JS after landing-page bundle audit.
- Update browserslist, remove dead Tailwind font config, and add the missing color tokens or switch billing page to defined utilities.
