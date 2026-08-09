# Ads Integration — Status & Troubleshooting

## Overview

TaskMind monetizes the free tier with **Google AdSense** banner and rail ad
slots. Ads are **consent-gated**: they never render or load until the visitor
explicitly opts in, and can be toggled off at any time from Settings.

This document explains the current status of the integration, how it works,
how to verify it is actually serving ads, and how to resolve issues.

---

## Current Status (as of this documentation)

| Item | Status | Notes |
|------|--------|-------|
| AdSense publisher ID configured (`NEXT_PUBLIC_ADSENSE_CLIENT`) | ✅ Configured | `ca-pub-8065082084695888` in `.env` and `.env.local` |
| Ad unit slot ID configured (`NEXT_PUBLIC_ADSENSE_SLOT`) | ✅ Configured | `3887136046` in `.env` and `.env.local` |
| AdSense loader script (`adsbygoogle.js`) | ✅ Lazy-loaded | Only injected when a unit is near viewport `AND` consented |
| Ad units (`<ins class="adsbygoogle">`) | ✅ Implemented | Responsive auto-format, `data-full-width-responsive` |
| Consent gate | ✅ Implemented | `taskmind:ads-consent` localStorage flag; banner + Settings toggle |
| Placement — desktop rail | ✅ Implemented | `AdsRail` (`.hidden lg:block`, 25vw, 2 sticky slots) |
| Placement — mobile block | ✅ Implemented | `AdBlock` in `DashboardHome` (336px, `lg:hidden`) |
| Fallback placeholder | ✅ Implemented | "Slot available / Remove ads with Pro" |
| Layout-shift protection | ✅ Implemented | Stable `min-h-[250px]` reservations |
| AdSense account approved / serving real ads | ⚠️ **External** | Depends on Google AdSense account approval & live domain |
| Privacy & Terms pages | ✅ Present | `/privacy`, `/terms` linked from banner |
| Consent management platform (CMP/TCF) for EEA | ❌ Deferred | Not yet implemented |

> **Bottom line:** The code and credentials are in place and the integration is
> fully wired. Whether a real ad **fills** is controlled by Google AdSense
> (account approval, policy compliance, live traffic, and the serving domain).
> Locally with consent enabled, the ad unit is rendered and the fill request is
> pushed to AdSense; an empty/blank slot means AdSense is not serving a creative
> (not approved, domain mismatch, or no competing ad).

---

## Architecture

```
Visitor visits app
   │
   ▼
AdsConsentBanner / Settings toggle ──► setAdsConsent(true)  (localStorage: taskmind:ads-consent)
   │                                        │
   │                                        ▼
   │                           dispatch ADS_CONSENT_EVENT
   │                                        │
   ▼                                        ▼
AdUnit (AdsRail / AdBlock) ──► IntersectionObserver (near viewport?)
   │                                        │
   │                           visible + hasAdsConfig() + adsConsented()
   │                                        ▼
   │                              loadAdSenseScript()   (inject adsbygoogle.js once)
   │                                        │
   │                                        ▼
   │                              pushAd(ins)  →  window.adsbygoogle.push({})
   │                                        │
   ▼                                        ▼
Real ad fills                     Fallback placeholder if not
(or empty reserved slot)          configured / not consented
```

Key files:

| File | Purpose |
|------|---------|
| `src/lib/ads.ts` | Config (`AD_CLIENT`, `AD_SLOT`), `hasAdsConfig()`, consent gate, lazy script loader, `pushAd` (dedupe via `WeakSet`, error-swallowing) |
| `src/components/layout/AdsRail.tsx` | `AdUnit`, `AdsRail` (desktop rail), `AdBlock` (mobile block) |
| `src/components/layout/AdsConsentBanner.tsx` | Opt-in banner shown when ads configured but not yet consented |
| `src/components/settings/SettingsView.tsx` | Ads toggle in Settings (respects consent + config) |
| `src/components/layout/DashboardLayout.tsx` | Mounts `AdsConsentBanner` + `AdsRail` |
| `src/components/dashboard/DashboardHome.tsx` | Mounts `AdBlock` (mobile) |
| `src/lib/storage.ts` | `adsConsent: "taskmind:ads-consent"` storage key |

---

## How to verify ads are working

### 1. Confirm configuration is loaded

```bash
grep -r "ADSENSE" .env .env.local
# Expect:
#   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-8065082084695888
#   NEXT_PUBLIC_ADSENSE_SLOT=3887136046
```

### 2. Run the app and grant consent

```bash
npm run dev
# open http://localhost:3000
```

1. The **consent banner** should appear at the top (if not already dismissed).
   Click **"Enable ads"**.
2. In Settings → **Advertising**, the toggle should be **On**.
3. Scroll the desktop right rail (or the mobile in-content block) into view.

### 3. Check the browser DevTools

Open **Network** tab and filter for `adsbygoogle` / `pagead`:

- **`adsbygoogle.js`** should be requested (once) when a unit becomes visible.
- After the push, look for a separate request to `googleads.g.doubleclick.net`
  or `pagead2.googlesyndication.com` — this is the actual **ad fill**.

Open **Console**:

- No critical errors expected (push errors are swallowed by design).
- A filled ad will render content inside the reserved `ins.adsbygoogle` box.

### 4. Interpreting the states

| Rendered state | Meaning |
|----------------|---------|
| "Sponsored" label + real ad content | 💰 **Working** — AdSense filled the unit |
| "Sponsored" label + empty reserved box | AdSense configured & pushed, but no creative served (approval/domain/no-fill) |
| "Advertisement / Slot available / Remove ads with Pro" | Placeholder — ads not configured OR consent not granted |
| No visible slot at all | `lg:` breakpoint hidden on small screens (rail) — use desktop |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ADSENSE_CLIENT` | For ads | AdSense publisher ID (e.g. `ca-pub-8065082084695888`) |
| `NEXT_PUBLIC_ADSENSE_SLOT` | For ads | Ad unit slot ID (e.g. `3887136046`) |

> **Security:** These are **not secret** (they are embedded in the public ad
> markup), so they are safe as `NEXT_PUBLIC_*`. Do not expose any private
> AdSense API keys.

---

## Common issues & solutions

### 1. Ads configured but unit stays empty (no fill)

**Cause:** AdSense is not serving a creative for that slot/domain.

**Solutions:**
1. Verify the AdSense account is **approved** and the site is **submitted** in
   the AdSense dashboard.
2. Ensure the **serving domain** matches an approved site. TaskMind references
   `taskmind.ai`, `taskmind.app`, and `whatshouldido-five.vercel.app` in
   metadata/README — AdSense requires a consistent, approved domain. Pick one
   and set `NEXT_PUBLIC_APP_URL` accordingly.
3. Test with real traffic; AdSense often shows nothing on localhost or with
   very low traffic.

### 2. Banner does not appear / ads never load

**Cause:** Consent not granted, or banner dismissed, or config missing.

**Solutions:**
- Manually clear the flags in the browser:
  ```js
  localStorage.removeItem("taskmind:ads-consent");
  localStorage.removeItem("taskmind:ads-banner-dismissed");
  ```
- Confirm `hasAdsConfig()` is true (both env vars set).
- In Settings, turn the **Advertising** toggle off then on.

### 3. AdSense script not injected

**Cause:** The lazy loader only injects when a unit is **visible (intersecting)**
**and** consent is granted.

**Solutions:**
- Scroll the ad slot into view.
- Grant consent (banner or Settings).
- Confirm the page is not cached from before consent changed (hard reload).

### 4. Layout shift / blank space

This is **by design** — the reserved `min-h-[250px]` prevents CLS. If a slot
never fills, the reserved space remains as a placeholder. This is expected.

### 5. EEA / GDPR consent requirements

**Status:** Not yet implemented. A consent management platform (CMP / TCF) is
deferred. Until then, the in-app opt-in banner is the only consent control.
For EEA compliance, integrate a CMP before relying on ads for EEA traffic.

---

## Troubleshooting checklist

1. `grep -r "ADSENSE" .env .env.local` → both vars present?
2. `npm run dev`, load page, click **Enable ads**.
3. DevTools **Network** → `adsbygoogle.js` requested?
4. DevTools **Network** → doubleclick/pagead fill request?
5. DevTools **Console** → no errors?
6. AdSense dashboard → site approved? domain matches? slot active?

---

## Related files

| File | Purpose |
|------|---------|
| `src/lib/ads.ts` | Config, consent gate, lazy script loader, push logic |
| `src/components/layout/AdsRail.tsx` | `AdsRail`, `AdBlock`, `AdUnit` components |
| `src/components/layout/AdsConsentBanner.tsx` | Opt-in consent banner |
| `src/components/settings/SettingsView.tsx` | Advertising toggle in Settings |
| `src/components/layout/DashboardLayout.tsx` | Mounts banner + desktop rail |
| `src/components/dashboard/DashboardHome.tsx` | Mounts mobile ad block |
| `src/lib/storage.ts` | `taskmind:ads-consent` key |
| `Ads.md` | Static AdSense raw snippet (reference only; app uses the component) |
| `enhancement-plan/features/17-ads-integration.md` | Feature design & roadmap |
