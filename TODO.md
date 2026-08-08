# Ads Integration Plan

## Goal
Enable real, policy‑compliant, consent‑gated Google AdSense ads in the layout.

## Required Credentials
- **NEXT_PUBLIC_ADSENSE_CLIENT** – your AdSense publisher ID (e.g. `ca-pub-1234567890123456`).
- **NEXT_PUBLIC_ADSENSE_SLOT** – ad unit slot ID (e.g. `1687812345`).

Add these to `.env.example` (and `.env.local` for local dev) alongside the existing TokenRouter variables.

```dotenv
# Google AdSense (for Ads Integration)
NEXT_PUBLIC_ADSENSE_CLIENT=
NEXT_PUBLIC_ADSENSE_SLOT=
```

> **Security:** These values are not secret, but keep them server‑side only; do not expose any private AdSense keys.

## Implementation Steps

1. **Update `src/lib/ads.ts`**
   - Export `AD_CLIENT` and `AD_SLOT` from env vars.
   - Ensure `hasAdsConfig()` checks both are set.
   - Keep the existing consent gate (`adsConsented`) and `setAdsConsent`.

2. **Lazy Script Loading**
   - Keep `loadAdSenseScript()` that injects `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`.
   - Ensure it runs only once and only when an ad unit is about to be rendered.

3. **Ad Unit Component (`AdUnit.tsx`)**
   - Render an `<ins className="adsbygoogle">` with:
     - `data-ad-client={AD_CLIENT}`
     - `data-ad-slot={AD_SLOT}`
     - `style={{ display: "block" }}`
     - `data-ad-format="auto"`
     - `data-full-width-responsive="true"`
   - Call `pushAd(unit)` after the script loads to signal AdSense to fill the unit.
   - Guard duplicate pushes with a `WeakSet` (already in code) and swallow errors.

4. **Ad Rendering Logic**
   - `AdUnit` becomes visible when:
     - It is intersecting the viewport (via IntersectionObserver).
     - Ads are configured (`hasAdsConfig()`).
     - Visitor has consented (`adsConsented`).
   - When visible and consented, load the script and push the ad.
   - If any condition fails, render the existing placeholder (“Advertisement / Slot available”).

5. **Stable Layout & CLS**
   - Reserve a minimum height (e.g., `min-h-[250px]`) for rail and block slots.
   - Use responsive container dimensions (`w-full`) to avoid layout shift.
   - Add a fallback UI (“Remove ads with Pro”) for when ads do not fill.

6. **Consent Flow Integration**
   - Provide a UI toggle that calls `setAdsConsent(true/false)`.
   - Ensure the toggle updates the stored consent value.
   - Ads only render after consent is `true`.

7. **Testing & Validation**
   - Verify script injects once.
   - Confirm ad units render with real fill when consented.
   - Check that placeholders appear when consent is false or config missing.
   - Validate no console errors on missing `adsbygoogle` object.
   - Ensure layout shift is minimized (measure CLS).

8. **Documentation**
   - Update `README.md` with instructions to obtain AdSense IDs and set them in `.env`.
   - Document the consent flow and fallback behavior.

9. **Optional Enhancements**
   - Add analytics tracking for impressions/errors.
   - Provide an “ad‑free” premium toggle that disables ad rendering.
   - Abstract ad provider behind `src/lib/ads.ts` for future swapping.

## Next Steps
- Add the two `NEXT_PUBLIC_ADSENSE_*` variables to `.env.example`.
- Implement the above changes in `src/lib/ads.ts` and related components.
- Create a consent UI component if not already present.
- Run local dev with real AdSense credentials to verify rendering.