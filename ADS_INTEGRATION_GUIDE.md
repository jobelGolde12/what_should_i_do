# Ads Integration Guide

This guide explains how to implement and configure ads in your dashboard layout.

## Overview

The dashboard includes:
- **Left sidebar navigation** with responsive design
- **Right sidebar ads container** (desktop only, xl breakpoint)
- **AdSense integration** for programmatic ads
- **Custom ad support** for direct advertising
- **Newsletter signup** for email marketing

## 1. Google AdSense Setup

### Prerequisites
1. **Create AdSense Account**: Go to [google.com/adsense](https://google.com/adsense) and set up your account
2. **Add Your Site**: Add your website domain to AdSense
3. **Get Approved**: Wait for site approval (usually 1-2 weeks)

### Configuration

1. **Get Your Publisher ID**:
   ```
   ca-pub-XXXXXXXXXXXXXXXX
   ```
   Replace the placeholder in `src/components/AdsManager.tsx` line 82

2. **Create Ad Units**:
   - Go to AdSense dashboard → Ads → Ad units
   - Create these units:
     - Sidebar ad: 300x250 responsive
     - Secondary sidebar ad: 300x200 responsive

3. **Update Ad Slots**:
   Replace the slot values in `src/components/AdsManager.tsx`:
   ```typescript
   const adUnits: AdUnit[] = [
     {
       id: 'ad-1',
       name: 'Main Sidebar Ad',
       slot: '/12345678/sidebar-ad', // ← Replace with your actual slot
       dimensions: { width: 300, height: 250 }
     },
     {
       id: 'ad-2',
       name: 'Secondary Sidebar Ad',
       slot: '/12345678/sidebar-ad-2', // ← Replace with your actual slot
       dimensions: { width: 300, height: 200 }
     }
   ];
   ```

## 2. AdSense Script Integration

Add this to your `src/app/layout.tsx` in the `<head>` section:

```tsx
import Script from 'next/script';

// Add inside the <head> of your layout
<Script
  id="adsense-init"
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
  strategy="afterInteractive"
  crossOrigin="anonymous"
/>
```

## 3. Environment Configuration

Create environment variables in `.env.local`:

```env
# Ads Configuration
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SLOT_1=/12345678/sidebar-ad
NEXT_PUBLIC_ADSENSE_SLOT_2=/12345678/sidebar-ad-2
```

Update the AdsManager to use environment variables:

```typescript
const adUnits: AdUnit[] = [
  {
    id: 'ad-1',
    name: 'Main Sidebar Ad',
    slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_1 || '/12345678/sidebar-ad',
    dimensions: { width: 300, height: 250 }
  },
  {
    id: 'ad-2',
    name: 'Secondary Sidebar Ad',
    slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_2 || '/12345678/sidebar-ad-2',
    dimensions: { width: 300, height: 200 }
  }
];
```

## 4. Alternative Ad Networks

### Media.net
```typescript
// Add to layout.tsx
<Script
  id="medianet-init"
  src="https://contextual.media.net/dmedianet.js?cid=XXXXXXXX"
  strategy="afterInteractive"
/>
```

### Amazon Publisher Services
```typescript
// Add to layout.tsx
<Script
  id="aps-init"
  src="https://c.amazon-adsystem.com/aax2/apstag.js"
  strategy="afterInteractive"
/>
```

## 5. Custom Ads

Use the `CustomAd` component for direct advertising:

```tsx
import { CustomAd } from './AdsManager';

<CustomAd
  title="Your Product"
  description="Amazing description here"
  imageUrl="/ads/your-product.jpg"
  linkUrl="https://yourproduct.com"
/>
```

## 6. Ad Blocking Detection

Add ad block detection:

```typescript
// Add to AdsManager.tsx
export function useAdBlockDetector() {
  const [adBlockDetected, setAdBlockDetected] = useState(false);

  useEffect(() => {
    const fakeAd = document.createElement('div');
    fakeAd.innerHTML = '&nbsp;';
    fakeAd.className = 'adsbox pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad';
    fakeAd.style.cssText = 'position: absolute; top: -10px; left: -10px;';
    
    document.body.appendChild(fakeAd);
    
    setTimeout(() => {
      if (fakeAd.offsetHeight === 0) {
        setAdBlockDetected(true);
      }
      document.body.removeChild(fakeAd);
    }, 100);
  }, []);

  return adBlockDetected;
}
```

## 7. Privacy Compliance

### GDPR/CCPA Compliance
1. **Update your privacy policy** to mention ads
2. **Add cookie consent** banner (recommended):
   ```bash
   npm install react-cookie-consent
   ```
3. **Configure consent management**

### Example Cookie Consent Integration:
```tsx
import CookieConsent from "react-cookie-consent";

<CookieConsent
  location="bottom"
  buttonText="Accept"
  cookieName="adsConsent"
  style={{ background: "#2B373B" }}
  buttonStyle={{ color: "#4e503b", fontSize: "13px" }}
>
  This website uses cookies to personalize ads and analyze traffic.
</CookieConsent>
```

## 8. Ad Performance Optimization

### Best Practices:
1. **Lazy Loading**: Ads are already set to load after page interaction
2. **Responsive Design**: Ads adapt to different screen sizes
3. **Above the Fold**: Main ad is in prime sidebar position
4. **Mobile Considerations**: Ads only show on desktop (xl+) for better UX

### Performance Monitoring:
Add analytics tracking for ad performance:

```typescript
// Add to AdsManager.tsx
useEffect(() => {
  if (adLoaded) {
    // Track ad impression
    gtag('event', 'ad_impression', {
      ad_unit: adUnit.name,
      ad_slot: adUnit.slot
    });
  }
}, [adLoaded]);
```

## 9. Revenue Tracking

### AdSense Revenue
- Monitor through AdSense dashboard
- Track key metrics:
  - Page RPM (Revenue per mille)
  - CPC (Cost per click)
  - CTR (Click-through rate)

### Custom Ad Revenue
```typescript
// Track custom ad clicks
const trackCustomAdClick = (adTitle: string) => {
  gtag('event', 'custom_ad_click', {
    ad_title: adTitle,
    value: 0.50 // Example revenue value
  });
};
```

## 10. Testing

### Development Mode:
- Ads show as placeholders in development
- No actual AdSense ads load to prevent policy violations

### Production Testing:
1. **Test Ad Loading**: Verify ads appear correctly
2. **Test Responsiveness**: Check ads on different screen sizes
3. **Test Click Tracking**: Ensure analytics fire properly
4. **Test Ad Blocking**: Verify fallback content works

## 11. Maintenance

### Regular Tasks:
1. **Monitor Ad Performance**: Check AdSense dashboard weekly
2. **Update Ad Units**: Rotate ad formats for better performance
3. **Review Policies**: Stay updated on AdSense policies
4. **Optimize Placement**: Test different ad positions

### Common Issues:
- **Ads Not Showing**: Check publisher ID and ad slots
- **Low Revenue**: Try different ad formats/placements
- **Policy Violations**: Review AdSense program policies

## 12. Monetization Strategy

### Ad Revenue Optimization:
1. **Experiment with Ad Formats**: Test text vs display ads
2. **Optimize Ad Placement**: Use heatmap data
3. **A/B Test**: Try different ad positions
4. **Fill Rate**: Ensure 100% ad inventory fill

### Diversification:
1. **Direct Ad Sales**: Use CustomAd component for sponsors
2. **Affiliate Marketing**: Add affiliate links in ad space
3. **Newsletter Revenue**: Build email list for future promotions

## Quick Setup Checklist

- [ ] Create AdSense account
- [ ] Add site to AdSense
- [ ] Get publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`)
- [ ] Create ad units (300x250, 300x200)
- [ ] Update environment variables
- [ ] Add AdSense script to layout
- [ ] Test in development (should show placeholders)
- [ ] Deploy to production
- [ ] Verify ads load correctly
- [ ] Set up analytics tracking
- [ ] Add privacy policy disclosure

Your ads should now be fully functional!