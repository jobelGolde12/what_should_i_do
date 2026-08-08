# Feature 17 — Ads Integration

## 1. What it is & its role

The **Ads Integration** feature displays sponsor/advertisement slots in the layout (a desktop right rail and a mobile in-content block) using **Google AdSense**. Its role is monetization of the free-to-use product.

## 2. Current functionality

### Where it lives
- **Components:** `src/components/layout/AdsRail.tsx` → `AdsRail`, `AdBlock`, and `AdUnit`.
- **Load script:** `src/app/page.tsx` loads the AdSense loader (`adsbygoogle.js`).
- **Client ID:** `process.env.NEXT_PUBLIC_ADSENSE_CLIENT`.

### How it works today
1. `AdUnit` lazily registers an IntersectionObserver and becomes "visible" when scrolled into view.
2. If `NEXT_PUBLIC_ADSENSE_CLIENT` is set, it renders a `<div>` with a placeholder size (no actual ad push call to `adsbygoogle`).
3. If not set, it renders a placeholder "Advertisement / Slot available" block.
4. `AdsRail` shows two sticky slots on desktop (`25vw` rail); `AdBlock` shows one 336px block on mobile.

### Current limitations
- **Not actually rendering working ads** — the code renders a placeholder container but never calls `(adsbygoogle = window.adsbygoogle || []).push({})` and uses no real ad unit/slot IDs.
- **Inconsistent domain** — metadata/README reference `taskmind.ai`, `taskmind.app`, and `whatshouldido-five.vercel.app`, which affects AdSense approval and canonical URLs.
- No **ad unit configuration**, responsive sizes, or `data-ad-slot`.
- **AdSense policy** requires real privacy policy, consent management (for EEA), and content review — not present.
- Ads may reduce perceived quality and performance (renders heavy placeholders).
- No A/B / placeholder fallback strategy beyond the static "Slot available" state.

## 3. Future enhancements (production-ready Ads Integration)

### 3.1 Real AdSense units
- Define proper `data-ad-client` / `data-ad-slot` and call `(adsbygoogle = window.adsbygoogle || []).push({})` once the unit is mounted.
- Use **responsive** ad units and container-`fill` layouts.
- Set a consistent, approved domain for ads and SEO.

### 3.2 Consent & compliance
- Integrate a **consent management platform** (e.g., GDPR/TCF) and only load ads after consent.
- Add a **privacy policy** and **terms** linked from the layout.

### 3.3 Performance
- Lazy-load the AdSense script only when a unit is near viewport.
- Reserve stable space to avoid layout shift (CLS).
- Add a graceful **fallback content** (e.g., "Remove ads with Pro") when ads fail to fill.

### 3.4 Measurements
- Track impressions/errors and integrate with an analytics layer.

### 3.5 Architecture
- Optionally build a **display-ad abstraction** (Google AdSense, or alternates like Carbon/EthicalAds, or a self-hosted sponsorship slot) to avoid vendor lock-in and to support a premium "ad-free" tier later.

### 3.6 Testing
- Tests for consent-gating, lazy script load, and slot rendering.
- E2E check that no layout shift occurs from ad rendering.

> **Status: DONE** — Implemented in this round: real responsive AdSense units (`ins.adsbygoogle` with `data-ad-client`/`data-ad-slot`/`data-ad-format="auto"`) driven by `NEXT_PUBLIC_ADSENSE_CLIENT` + `NEXT_PUBLIC_ADSENSE_SLOT`; lazy AdSense loader (`loadAdSenseScript`) injected only when a unit is near viewport (removed the eager `next/script` load from `page.tsx`); `pushAd` guards against duplicate pushes and swallows errors; consent gate via `taskmind:ads-consent` (ads only render+load after consent, `setAdsConsent` ready for a settings toggle); stable 250px min-height reservations to avoid CLS; fallback "Slot available / Remove ads with Pro" placeholder; display-ad abstraction in `src/lib/ads.ts` so the vendor can be swapped later. Consent UI, CMP, privacy/terms pages and analytics deferred.

> **Definition of "done" for this feature:** Ads display actual responsive, policy-compliant, consent-gated units with fallbacks, minimal layout shift, and consistent domain/performance.
