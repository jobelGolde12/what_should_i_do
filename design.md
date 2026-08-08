# Design System & UI Specification
## Inspirational Reference: C.H.I.-Style Home/Business Garage Door Landing Page

> **Purpose:** This document translates the supplied inspirational screenshot into a detailed, implementation-ready design specification. The goal is to capture the visual language, layout rhythm, hierarchy, imagery, and interaction patterns of the reference without requiring a pixel-for-pixel copy.
>
> **Primary design character:** premium, editorial, architectural, clean, trustworthy, image-led, and conversion-focused.

---

# 1. Design Direction

The website should feel like a premium manufacturer/service brand rather than a generic construction website.

The reference combines:

- A very clean white canvas
- A compact professional navigation bar
- Large editorial typography
- A short, confident headline
- Strong red/black CTA contrast
- A subtle dotted architectural/grid texture
- Large lifestyle/product photography
- An asymmetrical image collage
- Generous whitespace
- Small navigation labels and restrained UI
- A premium industrial/residential aesthetic

The overall experience should communicate:

**Quality + Craftsmanship + Modern Design + Reliability + Confidence**

Avoid making the interface overly rounded, overly colorful, or heavily card-based. The reference relies on **composition and photography** rather than large numbers of UI containers.

---

# 2. Visual Personality

## Keywords

- Premium
- Minimal
- Architectural
- Modern
- Editorial
- Professional
- Industrial
- Residential
- Trustworthy
- Sophisticated
- Spacious
- High-converting

## Design Principles

### 2.1 Photography First

Photography should be one of the primary visual elements.

Use:

- Finished installations
- Modern homes
- Commercial buildings
- Garage doors
- Close-up product details
- Installation/workmanship photography
- Lifestyle images showing real usage

Avoid generic stock photography where possible.

### 2.2 Editorial Layout

The hero should not look like a standard centered SaaS landing page.

Use:

- Left-aligned typography
- Large negative space
- Offset image blocks
- Uneven image heights
- Overlapping/adjacent photography
- Strong horizontal and vertical rhythm

### 2.3 Controlled Asymmetry

The reference uses a deliberately asymmetrical composition.

Do not center everything.

The visual balance should come from:

- Text on the left
- Image collage toward the bottom/right
- Different image widths
- Different image heights
- White space between image blocks

### 2.4 Restrained Color

The majority of the page should be white or near-white.

Use a strong accent color only for:

- Primary CTA
- Important links
- Small decorative details
- Hover states
- Selected navigation states

---

# 3. Color System

Use a restrained architectural palette.

| Token | Suggested Value | Usage |
|---|---|---|
| `--color-background` | `#FFFFFF` | Main page background |
| `--color-surface` | `#F7F7F5` | Secondary sections |
| `--color-text` | `#171717` | Primary headings/body |
| `--color-text-muted` | `#6B6B6B` | Supporting text |
| `--color-border` | `#DCDCDC` | Navigation/dividers |
| `--color-accent` | `#C8102E` | Primary CTA/accent |
| `--color-accent-dark` | `#9F0D24` | Hover/active accent |
| `--color-dark` | `#111111` | Secondary CTA/navigation |
| `--color-white` | `#FFFFFF` | Text on dark/accent elements |

### Accent Usage

The red accent should be used sparingly.

Good:

- `Get a Quote`
- Small underline
- Decorative arrow
- Active state
- Important micro-label

Avoid:

- Large red backgrounds everywhere
- Red cards
- Red body text
- Red navigation bars

The accent should feel like a **brand signature**, not the dominant page color.

---

# 4. Typography

The typography should resemble a modern architectural/editorial website.

## Recommended Font Stack

### Primary

Use a clean sans-serif:

```css
font-family:
  Inter,
  Helvetica Neue,
  Helvetica,
  Arial,
  sans-serif;
```

Alternative premium combinations:

- Inter + DM Sans
- Manrope + Inter
- Neue Haas Grotesk-style alternative
- Helvetica Neue-style system stack

## Typography Scale

### Hero Heading

Desktop:

```text
font-size: 64px–76px
line-height: 0.98–1.05
font-weight: 400–500
letter-spacing: -0.045em
```

Tablet:

```text
font-size: 48px–58px
```

Mobile:

```text
font-size: 38px–46px
line-height: 1.02
```

The heading should feel large without being excessively bold.

### Section Heading

```text
font-size: 42px–56px
line-height: 1.05
font-weight: 400–500
letter-spacing: -0.035em
```

### Body Text

```text
font-size: 15px–18px
line-height: 1.6
color: var(--color-text-muted)
```

### Navigation

```text
font-size: 12px–13px
font-weight: 400–500
```

### Button

```text
font-size: 12px–13px
font-weight: 600
```

Use sentence case rather than excessive uppercase text.

---

# 5. Global Layout

## Maximum Width

Use a large responsive container:

```css
--container-width: 1440px;
```

Suggested horizontal padding:

```css
Desktop: 40px–64px
Tablet: 28px–40px
Mobile: 20px–24px
```

The page should retain visible whitespace around the content.

## Grid

Use a 12-column desktop grid.

```text
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
```

Suggested hero:

- Text: columns 1–6
- Image composition: columns 6–12
- Lower image row: spans multiple columns

The exact placement can vary depending on screen width.

---

# 6. Header / Navigation

The header should be extremely clean.

## Structure

```text
┌───────────────────────────────────────────────────────────────┐
│ LOGO     Residential ▾   Commercial ▾   Dealers ▾   Shopping ▾ │
│          About ▾                         [Request a Quote]     │
└───────────────────────────────────────────────────────────────┘
```

## Header Characteristics

- White background
- Thin bottom border
- Compact height
- Logo aligned left
- Navigation centered/right
- CTA aligned far right
- Minimal shadows
- No large hamburger menu on desktop

### Recommended Height

```text
Desktop: 64px–76px
Tablet: 64px
Mobile: 64px
```

## Logo

The logo should remain visually small.

Recommended:

```text
Height: 24px–34px
```

Do not allow the logo to dominate the hero.

## Navigation Items

Example:

- Residential
- Commercial
- Dealers
- Shopping Tools
- About

Each item may include a small downward chevron.

### Navigation Hover

Use:

- Slight color shift
- Thin underline
- Small accent indicator

Avoid large animated dropdown effects.

## Header CTA

Text:

**Request a Quote**

Style:

- Dark background
- White text
- Compact height
- Sharp or very slightly rounded corners
- Strong hover state

---

# 7. Hero Section

The hero is the most important visual composition.

## Recommended Structure

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  The finishing touch to                                      │
│  your home or business                                       │
│                                                              │
│  Garage doors with style and substance.                      │
│                                                              │
│  [Get a Quote] [Build My Door]                               │
│                                                              │
│                                      ┌─────────────┐          │
│                                      │ Product     │          │
│                                      │ image       │          │
│                                      └─────────────┘          │
│                                                              │
│  ┌────────┐  ┌────────────────┐  ┌────────────┐  ┌─────────┐ │
│  │ image  │  │ lifestyle      │  │ detail     │  │ product │ │
│  │        │  │ installation   │  │ image      │  │ image   │ │
│  └────────┘  └────────────────┘  └────────────┘  └─────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Hero Height

Desktop:

```text
min-height: 680px–780px
```

Large desktop:

```text
min-height: 760px–850px
```

Mobile:

```text
auto
padding-top: 56px
padding-bottom: 48px
```

Do not force an excessively tall mobile hero.

---

# 8. Hero Background

The reference includes a subtle dotted pattern.

Create it with CSS rather than using an image.

Example concept:

```css
background-image: radial-gradient(
  rgba(0, 0, 0, 0.10) 0.8px,
  transparent 0.8px
);

background-size: 8px 8px;
```

### Important

The dots should be subtle.

Recommended opacity:

```text
0.05–0.12
```

The pattern must remain behind the content and should never reduce readability.

Possible variation:

- Dots only on the right half
- Dots only behind the image collage
- Fade dots toward the edges
- Use a very light gray rather than black

---

# 9. Hero Heading

Reference-inspired copy structure:

```text
The finishing touch to
your home or business
```

The heading should use intentional line breaks.

Example:

```html
<h1>
  The finishing touch to
  <br />
  your home or business
</h1>
```

The second line can have a slightly different visual emphasis if appropriate.

## Heading Behavior

Desktop:

- Large
- Thin/medium weight
- Tight line height
- Left aligned

Mobile:

- Reduce font size
- Maintain intentional line breaks where possible
- Avoid awkward single-word lines

---

# 10. Hero Supporting Text

Use one short sentence below the heading.

Example:

> Garage doors with style and substance.

Style:

```text
font-size: 14px–16px
color: #666
max-width: 360px
```

Keep it concise.

Do not add a large paragraph.

---

# 11. Hero CTA Buttons

Use two buttons.

### Primary

**Get a Quote**

Style:

```text
background: var(--color-accent)
color: white
```

### Secondary

**Build My Door**

Style:

```text
background: var(--color-dark)
color: white
```

Alternative:

```text
white background
dark border
dark text
```

## Button Dimensions

Desktop:

```text
height: 44px–50px
padding: 0 20px–24px
```

Mobile:

```text
height: 48px
```

## Button Radius

Use minimal rounding:

```text
0px–3px
```

The reference is more architectural than playful.

---

# 12. Hero Image Composition

This is one of the defining features of the design.

Do not use one large hero image.

Instead create a **collage of multiple images**.

## Suggested Image Types

### Image 1 — Narrow Vertical

A partial home/garage image.

```text
Width: 8–12%
Height: 150–220px
```

### Image 2 — Large Lifestyle Image

A homeowner or installer interacting with a garage door.

```text
Width: 28–34%
Height: 230–320px
```

### Image 3 — Detail/Product Image

Close-up architectural image.

```text
Width: 20–25%
Height: 170–260px
```

### Image 4 — Main Product Image

Large garage-door installation.

```text
Width: 25–30%
Height: 250–360px
```

## Image Treatment

- No heavy filters
- Natural photography
- Sharp images
- Realistic colors
- Minimal border
- No default rounded cards

Optional:

```css
object-fit: cover;
```

---

# 13. Image Collage Positioning

The collage should feel deliberately assembled.

Example desktop positioning:

```text
Image A:
left: 0
bottom: 0

Image B:
left: 15%
bottom: 0

Image C:
left: 48%
bottom: 15%

Image D:
right: 0
bottom: 5%
```

Use CSS Grid when possible instead of excessive absolute positioning.

However, selected images may use controlled transforms:

```css
transform: translateY(-20px);
```

The composition should not look random.

---

# 14. Image Annotation / Decorative Graphic

The reference includes a small handwritten-style annotation and arrow.

This can be recreated as a subtle editorial detail.

Example:

```text
"Your home's
finishing touch!"
           ↗
```

## Style

- Handwritten font
- Small
- Accent red
- Slight rotation
- Curved arrow

Use this sparingly.

The annotation should point toward an important product/image.

Possible implementation:

```text
SVG curved arrow
+
handwritten text
```

SVG is preferred over a raster image.

---

# 15. Responsive Hero

## Desktop ≥ 1200px

Use:

- Two-column hero
- Large typography
- Full image collage
- Horizontal CTA buttons
- Full navigation

## Tablet 768–1199px

Use:

- Reduced heading
- Smaller image collage
- Slightly smaller navigation
- Maintain asymmetry
- Reduce image count if necessary

## Mobile < 768px

Change the composition.

Recommended:

```text
Header
↓
Hero heading
↓
Description
↓
CTA buttons
↓
Primary image
↓
Secondary image strip
```

Do not attempt to preserve the exact desktop collage on mobile.

The priority should be:

1. Headline
2. CTA
3. Main product image
4. Supporting imagery

---

# 16. Mobile Header

Use:

```text
┌─────────────────────────────────────────┐
│ LOGO                              ☰     │
└─────────────────────────────────────────┘
```

Menu opens a full-width navigation panel.

Mobile menu items:

- Residential
- Commercial
- Dealers
- Shopping Tools
- About
- Request a Quote

The mobile menu should feel premium and simple.

Avoid a complex multi-level navigation unless required by the business.

---

# 17. Section 2 — Product Categories

After the hero, introduce the primary product categories.

Suggested heading:

**Built for the way you live and work.**

Possible categories:

```text
Residential
Commercial
Modern
Traditional
Custom
```

Use large editorial image tiles rather than small cards.

Example:

```text
┌──────────────────┐ ┌──────────────────┐
│                  │ │                  │
│  RESIDENTIAL     │ │  COMMERCIAL      │
│                  │ │                  │
│  Explore →       │ │  Explore →       │
└──────────────────┘ └──────────────────┘
```

---

# 18. Product Category Card Style

Avoid conventional SaaS cards.

Instead:

- Large image
- Minimal text
- Text overlay or beneath image
- Small arrow
- Strong typography

Hover behavior:

```text
Image scales from 1.00 → 1.04
```

Use:

```css
transition: transform 500ms ease;
```

Do not over-animate.

---

# 19. Section 3 — Brand / Craftsmanship

Introduce the company story.

Suggested structure:

```text
LEFT
Large heading

RIGHT
Short description
Supporting statistic
CTA
```

Example:

**Designed to make an entrance.**

Body copy:

> Thoughtful materials, reliable engineering, and designs made to complement the architecture around them.

CTA:

**Explore Our Story →**

---

# 20. Section 4 — Featured Products

Use an editorial product showcase.

Layout:

```text
┌──────────────────────────────┐
│                              │
│      LARGE PRODUCT IMAGE     │
│                              │
└──────────────────────────────┘

Product Name
Short description

[Explore Product →]
```

Optional horizontal product navigation:

```text
01  Modern
02  Classic
03  Contemporary
04  Custom
```

---

# 21. Section 5 — Inspiration Gallery

Use a masonry-style image gallery.

Recommended image mix:

- Exterior architecture
- Garage doors
- Close-up materials
- Installation
- Commercial properties
- Finished projects

The gallery should feel like an architecture magazine.

Avoid identical image sizes.

---

# 22. Section 6 — Quote / Conversion Section

Create a strong conversion area toward the lower part of the page.

Suggested heading:

**Ready to finish the look?**

Supporting text:

> Tell us about your project and we'll help you find the right solution.

CTA:

**Request a Quote**

Secondary option:

**Contact Us**

Keep this section simple.

---

# 23. Footer

Footer should be structured but not visually heavy.

Recommended structure:

```text
LOGO

Products
Residential
Commercial
Collections
Accessories

Company
About
Our Story
Resources
Contact

Support
Find a Dealer
FAQ
Warranty
Installation

Social
Instagram
Facebook
YouTube
```

Bottom:

```text
© 2026 Company Name
Privacy
Terms
Accessibility
```

Use a dark background if desired.

---

# 24. Navigation Interaction

Dropdown menus should use a premium mega-menu style.

Example:

```text
Residential
────────────────────────────────────────────
Collections
  Modern
  Traditional
  Contemporary

Shop by Style
  Glass
  Steel
  Wood

Featured
  [Large image]
```

Keep dropdown animations subtle:

```text
opacity: 0 → 1
transform: translateY(-4px) → translateY(0)
duration: 180–240ms
```

Avoid bouncy animations.

---

# 25. Interaction Design

## General Motion

Motion should be subtle and intentional.

Use:

```text
150–250ms
```

for interface interactions.

Use:

```text
400–700ms
```

for photography reveals.

### Page Load

Possible sequence:

1. Header fades in
2. Hero heading rises slightly
3. Supporting text appears
4. CTA buttons appear
5. Images reveal with a small vertical motion

Example:

```text
opacity: 0 → 1
transform: translateY(20px) → translateY(0)
```

Do not make the website feel like an animation demo.

---

# 26. Image Hover

For product/gallery images:

```text
Default:
scale(1)

Hover:
scale(1.03–1.05)
```

Use an image wrapper with:

```css
overflow: hidden;
```

Optional:

- Small arrow appears
- Image label shifts upward
- Slight dark overlay

---

# 27. Accessibility

The design must remain accessible despite its visual focus.

Requirements:

- WCAG-conscious contrast
- Visible keyboard focus states
- Semantic HTML
- Proper heading hierarchy
- Descriptive image alt text
- Buttons must be actual `<button>` or `<a>` elements
- Navigation must be keyboard accessible
- Do not rely solely on color to communicate state
- Respect `prefers-reduced-motion`

Example:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    scroll-behavior: auto;
    transition-duration: 0.01ms;
  }
}
```

---

# 28. Spacing System

Use a consistent spacing scale.

```text
4px
8px
12px
16px
24px
32px
48px
64px
80px
96px
120px
160px
```

Recommended section spacing:

```text
Desktop:
120px–160px

Tablet:
80px–120px

Mobile:
64px–88px
```

Do not make every section equally tall. Editorial rhythm should vary.

---

# 29. Border & Radius System

The reference is mostly sharp and architectural.

Use:

```text
Buttons: 0–3px
Images: 0px
Cards: 0–4px
Inputs: 2–4px
```

Avoid:

```text
border-radius: 20px
border-radius: 9999px
```

unless used for a specific utility element.

---

# 30. Shadows

Use very little shadow.

Preferred:

```css
box-shadow: 0 8px 30px rgba(0,0,0,0.06);
```

Only use shadows for:

- Dropdown menus
- Floating mobile menu
- Modal dialogs
- Important elevated UI

The main page should remain flat.

---

# 31. Buttons

## Primary Button

```text
Background: Accent Red
Text: White
Height: 46px
Padding: 0 22px
Radius: 2px
```

Hover:

```text
Background: Darker accent
```

## Secondary Button

```text
Background: Dark
Text: White
Height: 46px
Padding: 0 22px
Radius: 2px
```

## Text Link

Use for low-priority actions:

```text
Explore →
Learn More →
View Collection →
```

Add a subtle arrow movement on hover.

---

# 32. Forms

Quote forms should follow the same minimal aesthetic.

Example:

```text
First Name
[________________________]

Last Name
[________________________]

Email
[________________________]

Project Type
[ Select...              ▾ ]

Tell us about your project
[________________________]
[________________________]

[ Request a Quote ]
```

Input styling:

- White or off-white background
- Thin gray border
- Minimal radius
- Strong focus outline
- Comfortable height

---

# 33. Loading States

Use minimal skeleton/loading states.

Avoid animated spinners everywhere.

For image-heavy sections:

```text
Light neutral placeholder
→
Fade into image
```

---

# 34. Content Tone

Copy should be:

- Confident
- Short
- Clear
- Premium
- Helpful
- Human

Avoid:

- Excessive marketing language
- Huge paragraphs
- Generic buzzwords
- Repeated "best in class"
- Overly aggressive sales language

Preferred:

> Designed for your home. Built to last.

Instead of:

> We are the number one revolutionary industry-leading provider of premium solutions.

---

# 35. Recommended Component Architecture

If implementing with React/Next.js:

```text
components/
├── Header/
│   ├── Header.tsx
│   ├── DesktopNav.tsx
│   ├── MobileNav.tsx
│   └── MegaMenu.tsx
│
├── Hero/
│   ├── Hero.tsx
│   ├── HeroContent.tsx
│   ├── HeroActions.tsx
│   ├── HeroGallery.tsx
│   └── HeroAnnotation.tsx
│
├── ProductCategories/
│   ├── ProductCategories.tsx
│   └── CategoryCard.tsx
│
├── BrandStory/
│   └── BrandStory.tsx
│
├── ProductShowcase/
│   ├── ProductShowcase.tsx
│   └── ProductCard.tsx
│
├── Gallery/
│   └── InspirationGallery.tsx
│
├── QuoteCTA/
│   └── QuoteCTA.tsx
│
└── Footer/
    └── Footer.tsx
```

---

# 36. Suggested Page Structure

```text
<App>
  <Header />

  <main>
    <Hero />

    <ProductCategories />

    <BrandStory />

    <FeaturedProducts />

    <InspirationGallery />

    <QuoteCTA />
  </main>

  <Footer />
</App>
```

---

# 37. Hero Component Requirements

The hero component should support:

```ts
type HeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  images: {
    src: string;
    alt: string;
    className?: string;
  }[];
};
```

This allows the hero to be reused for different campaigns.

---

# 38. Image Performance

Because the design is image-heavy:

- Use WebP or AVIF
- Use responsive image sizes
- Lazy-load images below the fold
- Preload the primary hero image when appropriate
- Avoid unnecessarily huge source files
- Use `object-fit: cover`
- Define image dimensions to prevent layout shift

For Next.js:

```tsx
<Image
  src="/images/hero.jpg"
  alt="Modern garage door installation"
  fill
  priority
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

# 39. Performance Goals

Target:

```text
LCP: < 2.5s
CLS: < 0.1
INP: < 200ms
```

Prioritize:

1. Hero image optimization
2. Font loading
3. Minimal JavaScript
4. Proper image dimensions
5. Lazy loading
6. Avoiding unnecessary animation libraries

---

# 40. Recommended Technology

For a modern implementation:

```text
Framework:
Next.js / React

Styling:
Tailwind CSS or CSS Modules

Icons:
Lucide React

Animation:
CSS transitions
Framer Motion only where necessary

Images:
Next.js Image

Fonts:
Google Fonts or self-hosted font files
```

If using Tailwind, create design tokens rather than scattering arbitrary values throughout components.

---

# 41. Tailwind Design Tokens

Suggested values:

```js
colors: {
  background: "#FFFFFF",
  surface: "#F7F7F5",
  foreground: "#171717",
  muted: "#6B6B6B",
  border: "#DCDCDC",
  accent: "#C8102E",
  accentDark: "#9F0D24",
  dark: "#111111"
}
```

Spacing should follow the defined spacing system.

---

# 42. Do / Don't

## DO

- Use large editorial typography
- Use high-quality photography
- Keep backgrounds clean
- Use asymmetrical compositions
- Use strong whitespace
- Keep CTAs obvious
- Use subtle motion
- Keep the accent color restrained
- Use sharp architectural shapes
- Make the hero visually memorable

## DON'T

- Use excessive rounded cards
- Use giant gradients
- Use excessive shadows
- Use dozens of colors
- Center every section
- Use huge blocks of text
- Overuse animations
- Make every image the same size
- Use generic SaaS dashboard aesthetics
- Turn the site into a collection of cards

---

# 43. Visual Hierarchy

The viewer's eye should generally move in this order:

```text
1. Brand / Logo
        ↓
2. Hero headline
        ↓
3. Hero imagery
        ↓
4. Primary CTA
        ↓
5. Secondary imagery
        ↓
6. Product categories
        ↓
7. Brand story
        ↓
8. Product showcase
        ↓
9. Quote CTA
        ↓
10. Footer
```

The hero should communicate the company's value proposition within approximately **3–5 seconds**.

---

# 44. Reference-Specific Details to Preserve

The following elements are especially important because they create the visual identity seen in the supplied reference:

### 1. Compact Header

Keep the navigation visually small compared with the hero.

### 2. Large Left-Aligned Heading

The headline should occupy a significant amount of horizontal space.

### 3. Subtle Dot Pattern

Use a barely visible dotted texture to add depth without distracting from content.

### 4. Two CTA Buttons

Use one accent-colored CTA and one dark CTA.

### 5. Bottom Image Collage

Use multiple photographs with different widths and heights.

### 6. Editorial Annotation

A small handwritten note and curved arrow can point toward an important image/product.

### 7. Strong White Space

Do not fill every empty area.

### 8. Architectural Photography

Images should reinforce the relationship between the product and the building/home.

---

# 45. Final Design Goal

The completed website should feel like:

> **A premium architectural product brand with a modern editorial website.**

It should not feel like:

> A generic home-services website.

The most important design decision is the **combination of large typography + restrained UI + premium photography + asymmetric composition + subtle red accent**.

The website should feel calm when first viewed, then reveal more detail as the user scrolls.

---

# 46. Implementation Checklist

## Header

- [ ] Logo implemented
- [ ] Desktop navigation
- [ ] Dropdown indicators
- [ ] Request Quote CTA
- [ ] Mobile menu
- [ ] Sticky behavior if required

## Hero

- [ ] Large editorial headline
- [ ] Supporting description
- [ ] Primary CTA
- [ ] Secondary CTA
- [ ] Dotted background
- [ ] Multi-image collage
- [ ] Responsive image behavior
- [ ] Optional handwritten annotation

## Content

- [ ] Product category section
- [ ] Brand story section
- [ ] Featured products
- [ ] Inspiration gallery
- [ ] Quote CTA

## Footer

- [ ] Navigation groups
- [ ] Contact information
- [ ] Social links
- [ ] Legal links

## UX

- [ ] Keyboard navigation
- [ ] Visible focus states
- [ ] Accessible contrast
- [ ] Reduced-motion support
- [ ] Responsive layouts

## Performance

- [ ] WebP/AVIF images
- [ ] Responsive images
- [ ] Lazy loading
- [ ] Hero image priority
- [ ] Font optimization
- [ ] Layout-shift prevention

---

# 47. One-Sentence Design Brief

**Create a premium, minimalist architectural landing page that combines oversized editorial typography, a compact professional navigation bar, subtle dotted texture, restrained black/white/red branding, and an asymmetrical collage of high-quality residential and commercial photography to create a sophisticated, trustworthy, conversion-focused experience.**
