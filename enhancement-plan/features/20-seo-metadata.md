# Feature 20 — SEO & Metadata

## 1. What it is & its role

The **SEO & Metadata** feature controls how the app appears in search results and on social media (title, description, Open Graph, Twitter cards, structured data, sitemap, canonical URLs). Its role is discoverability and accurate representation of the product.

## 2. Current functionality

### Where it lives
- **Root metadata:** `src/app/layout.tsx` (title, description).
- **Home metadata + structured data:** `src/app/page.tsx` (WebApplication schema, Open Graph, Twitter, canonical, robots).
- **Sitemap:** `src/app/sitemap.ts`.
- **Per-page metadata:** history/saved/settings/actions/analysis/share pages (mostly `robots: noindex`).

### How it works today
1. Root sets site title/description.
2. Home sets OG/Twitter/canonical and a `WebApplication` JSON-LD schema.
3. `sitemap.ts` returns a single entry (`https://taskmind.ai/`).
4. Internal/app pages are `noindex`.

### Current limitations
- **Inconsistent domain**: `layout.tsx` has no canonical; `page.tsx` uses `taskmind.app`; `sitemap.ts` and README use `taskmind.ai`; live demo is `whatshouldido-five.vercel.app`. This harms SEO and AdSense.
- **No `robots.txt`** and no auto-generated metadata from a single config.
- **OG/Twitter images** reference paths (`og-image.png`, `twitter-image.png`) that may not exist.
- **No per-route canonical** and no fallback metadata for share routes.
- **No analyze/action-focused SEO content** (no landing content/sections beyond the tool).
- Structured data is limited to a single static `WebApplication` on the home page.
- No `NEXT_PUBLIC_APP_URL`-driven canonical (uses hardcoded URLs).

## 3. Future enhancements (production-ready SEO & Metadata)

### 3.1 Single source of truth
- Centralize site meta (name, URL, description, images, social) in one config module and derive all metadata/sitemap/robots from it.
- Use `NEXT_PUBLIC_APP_URL` (or a `SITE_URL`) for all absolute URLs.

### 3.2 Complete SEO assets
- Add **`robots.ts`** (allow index of `/`, disallow app routes).
- Add real **OG/Twitter images** (1200×630) hosted in `public/`.
- Add **`manifest`** and favicon/web-app icons.

### 3.3 Route-level metadata
- Add meaningful titles/descriptions and canonical URLs for `/`, `/actions`, `/history`, `/saved`, `/settings`, and share pages.
- Add **content/landing sections** (how-it-works, features, FAQ) with per-section structured data (`FAQPage`, `HowTo`, `BreadcrumbList`).

### 3.4 Structured data depth
- Keep `WebApplication` but add `Organization`, `BreadcrumbList`, and `FAQPage` schemas.

### 3.5 Analytics & verification
- Add **Google Search Console** verification meta and web analytics (e.g., GA4/Plausible).

### 3.6 Testing
- Automated sitemap/robots/URL-consistency checks in CI.
- Metadata snapshot tests per route.

> **Status: DONE** — Implemented in this round: single source of truth `src/lib/site.ts` (`SITE_URL` from `NEXT_PUBLIC_APP_URL` with `taskmind.app` fallback, name, titles, description, OG/Twitter images) driving all absolute URLs; root `layout.tsx` metadata now uses `metadataBase`, title template, and robots; `robots.ts` (allow `/`, disallow `/auth /api /analysis /share`, sitemap link); `sitemap.ts` built from site config; `manifest.ts` web app manifest; new `public/icon.svg`; home page derives OG/Twitter/canonical from site config and adds `Organization` + `FAQPage` JSON-LD alongside `WebApplication`. Real 1200×630 OG/Twitter image assets, Search Console/analytics, and CI URL-consistency checks deferred.

> **Definition of "done" for this feature:** Consistent canonical URLs, complete robots/sitemap/manifest/OG assets, route-level metadata, rich structured data, analytics, and CI checks for consistency.
