# Design System & UI Specification

## Inspirational Reference: Minimal Editorial Portfolio-Style Landing Page

> **Purpose:** This document translates the supplied screenshot into an implementation-ready visual design system for the existing website. The screenshot is used **only as a visual/design reference**. Its wording, subject matter, branding, and specific content must not be copied.

> **Design character:** minimalist, editorial, playful-but-premium, spacious, monochrome-first, typography-led, image/3D-object-led, and highly intentional.

---

# 1. Core Design Direction

The website should move away from a conventional service-business or SaaS appearance and instead use the visual language of a **small premium creative studio / modern editorial portfolio**.

The reference design is defined by:

- A nearly pure white canvas
- Extremely compact navigation
- Tiny, understated navigation typography
- A small text-based logo/brand mark
- Large thin editorial headline typography
- Strong left-side text composition
- A large isolated visual object on the right
- Generous empty space around the hero
- Very limited use of color
- Black/charcoal typography
- A single unexpected visual accent or object
- Minimal borders and almost no decorative UI
- Small social/action icons positioned in the header
- A clean horizontal rhythm
- A visually simple composition that relies on scale and spacing rather than cards

The design should feel:

**Minimal + Editorial + Creative + Premium + Confident + Modern**

Do not reproduce the screenshot literally. Recreate its **layout logic, visual hierarchy, spacing, typography, and restraint** while using the website's own content, imagery, brand, and functionality.

---

# 2. Visual Personality

## Keywords

- Minimal
- Editorial
- Creative
- Modern
- Elegant
- Playful
- Confident
- Spacious
- Lightweight
- Premium
- Human
- Art-directed
- Uncluttered

## Design Principles

### 2.1 Typography Is the Primary Visual Element

The hero should be recognizable even before the imagery is noticed.

Use:

- Large typography
- Thin or regular font weight
- Tight line height
- Slightly negative letter spacing
- Short text blocks
- Intentional line breaks
- Strong contrast between tiny metadata and large headline

The headline should occupy significant visual space without appearing heavy.

### 2.2 Empty Space Is Intentional

Whitespace is a major component of the design.

Do not attempt to fill empty areas with:

- Cards
- Decorative gradients
- Extra text
- Large background graphics
- Multiple CTAs
- Unnecessary statistics

The empty space should make the hero feel calm and expensive.

### 2.3 One Strong Visual Object

Instead of using a traditional full-width hero photograph, prioritize **one dominant visual element**.

Depending on the website's actual content, this can be:

- A product
- A product detail
- A carefully cut-out photograph
- A 3D render
- An architectural object
- A person/product interaction
- A branded illustration

The visual should feel intentionally placed rather than treated as a generic background image.

### 2.4 Controlled Playfulness

The screenshot uses an unusual object and human gesture to make a minimal page memorable.

For this website, use a similar principle:

- One unexpected visual
- One expressive crop
- One oversized object
- One subtle rotation
- One editorial annotation if appropriate

Do not turn the entire interface into a playful illustration.

---

# 3. Color System

The palette should be dramatically simpler than the previous design.

| Token | Suggested Value | Usage |
|---|---|---|
| `--color-background` | `#FFFFFF` | Primary page background |
| `--color-surface` | `#F8F8F6` | Optional secondary surface |
| `--color-text` | `#171717` | Headings and primary text |
| `--color-text-muted` | `#777777` | Supporting text |
| `--color-text-light` | `#A0A0A0` | Eyebrows and metadata |
| `--color-border` | `#E8E8E8` | Very subtle separators |
| `--color-dark` | `#111111` | Strong text / dark UI |
| `--color-white` | `#FFFFFF` | Text on dark elements |
| `--color-accent` | `#D96C92` | Optional creative accent |
| `--color-accent-soft` | `#F3D7E1` | Optional subtle highlight |

### Accent Usage

The accent is optional and must remain restrained.

Use it for:

- One hero visual
- Small hover details
- Tiny active indicators
- A subtle decorative element
- Selected states
- A small editorial graphic

Do not use the accent for:

- Large navigation backgrounds
- Every button
- Large gradients
- Entire sections
- Body text
- Multiple competing visual elements

The page should still look correct if the accent is removed.

---

# 4. Typography

## Primary Typeface

Use a clean contemporary grotesk/sans-serif.

Preferred options:

- Inter
- Helvetica Neue
- Neue Montreal-style sans-serif
- Geist
- Manrope
- Arial as fallback

Recommended stack:

```css
font-family:
  Inter,
  "Helvetica Neue",
  Helvetica,
  Arial,
  sans-serif;
```

## Typography Philosophy

The reference uses typography that feels light rather than bold.

Prefer:

```text
font-weight: 400
```

or:

```text
font-weight: 450–500
```

Avoid using `font-weight: 700–900` for the primary hero unless the actual content requires emphasis.

## Hero Heading

Desktop:

```text
font-size: 64px–88px
line-height: 0.94–1.02
font-weight: 400
letter-spacing: -0.055em
```

For very large screens:

```text
font-size: clamp(64px, 6.2vw, 104px)
```

Tablet:

```text
font-size: 52px–68px
```

Mobile:

```text
font-size: 42px–56px
line-height: 0.98–1.04
```

The heading should remain visually large even when the viewport becomes smaller.

## Eyebrow / Micro Label

Use very small uppercase or compact text:

```text
font-size: 8px–11px
font-weight: 500
letter-spacing: 0.12em–0.18em
text-transform: uppercase
```

The eyebrow should be visually quiet.

## Navigation

```text
font-size: 10px–12px
font-weight: 400–500
letter-spacing: 0
```

Navigation should never compete with the hero.

## Body Text

```text
font-size: 14px–17px
line-height: 1.55
font-weight: 400
color: var(--color-text-muted)
```

Keep paragraphs short.

---

# 5. Global Layout

## Maximum Width

Use a restrained editorial container:

```css
--container-width: 1280px;
```

For very large screens, allow the content to breathe:

```css
max-width: 1320px;
```

## Horizontal Padding

```text
Desktop: 48px–72px
Tablet: 32px–48px
Mobile: 20px–24px
```

The page should have visible white margins.

## Grid

Use a 12-column grid on desktop.

```text
1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
```

Recommended hero:

```text
Hero content: columns 1–7
Hero visual:  columns 7–12
```

The visual can slightly overflow its grid area to create the same relaxed composition as the reference.

---

# 6. Header / Navigation

The header should be much smaller and quieter than a conventional business website.

## Structure

```text
┌──────────────────────────────────────────────────────────────┐
│ Brand                         nav nav nav      ○ ○ ○      │
└──────────────────────────────────────────────────────────────┘
```

## Header Characteristics

- White background
- No heavy shadow
- No large CTA button
- Very small typography
- Brand aligned left
- Navigation near the upper center/right
- Social or utility icons aligned at the far right
- Large amounts of horizontal breathing room
- Minimal vertical height

## Header Height

```text
Desktop: 52px–68px
Tablet: 56px–64px
Mobile: 56px–64px
```

## Logo / Wordmark

The logo should be visually small.

Recommended:

```text
Height: 20px–28px
```

If the brand uses a two-line wordmark, preserve the compact stacked structure.

The logo should never become the dominant visual element.

## Navigation Items

Use the site's actual navigation/content labels.

Design rules:

- Keep labels short
- Use lowercase or sentence case where appropriate
- Avoid oversized uppercase navigation
- Avoid pill-shaped navigation
- Avoid large dropdown triggers

Example visual treatment:

```text
about    work    expertise    contact
```

The actual website labels should replace these examples.

## Social / Utility Icons

Place small icons at the far right.

Recommended:

```text
10px–12px
```

Use simple line icons.

Spacing:

```text
8px–12px
```

Avoid large social buttons or circular icon containers.

## Navigation Hover

Use extremely subtle feedback:

```text
color shift
+
thin underline
```

or:

```text
opacity: 0.55 → 1
```

Do not use:

- Bouncy animations
- Large dropdown panels
- Color explosions
- Thick underlines
- Scale effects

---

# 7. Hero Section

The hero is the most important part of the redesign.

The composition should closely follow the **visual structure** of the supplied screenshot:

```text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│        SMALL EYEBROW                                          │
│        Large editorial                                        │
│        headline                         LARGE VISUAL OBJECT   │
│        with intentional                  / IMAGE              │
│        line breaks                                           │
│                                                               │
│                                                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Hero Layout

Use a two-part composition:

### Left

Contains:

- Small eyebrow
- Large headline
- Optional short supporting statement
- Optional minimal text link/CTA

### Right

Contains:

- One dominant visual
- Product image
- Cutout image
- 3D object
- Architectural image
- Branded illustration

The visual should not have a conventional rectangular card treatment.

## Hero Height

Desktop:

```text
min-height: 620px–760px
```

Large desktop:

```text
min-height: 700px–820px
```

Mobile:

```text
min-height: auto
padding-top: 72px
padding-bottom: 72px
```

---

# 8. Hero Composition

## Horizontal Relationship

The hero should feel slightly off-center.

Recommended:

```text
Text begins around 8%–12% from the left edge.

Visual begins around 62%–68% of the viewport width.
```

The visual may extend closer to the right edge.

## Vertical Relationship

The headline should sit around the visual center of the hero rather than at the absolute top.

Example:

```text
Header
↓
Large whitespace
↓
Eyebrow
↓
Headline
↓
Optional supporting text
```

The visual may be vertically offset.

Example:

```css
transform: translateY(20px);
```

or:

```css
transform: translateY(-10px);
```

Use only enough movement to create balance.

---

# 9. Hero Eyebrow

The eyebrow is a small visual anchor above the headline.

Example structure:

```text
SMALL CATEGORY / CONTEXT
```

Design:

```text
font-size: 9px–11px
letter-spacing: 0.14em
font-weight: 500
color: var(--color-text-light)
```

Keep it short.

Do not turn the eyebrow into a paragraph.

---

# 10. Hero Heading

The headline should be:

- Large
- Thin
- Left aligned
- Short
- Editorial
- Highly readable
- Broken into deliberate lines

Example structure using the site's own content:

```html
<h1>
  Main value
  <br />
  proposition goes
  <br />
  here.
</h1>
```

Do not copy the screenshot's wording.

## Line Length

Aim for approximately:

```text
2–4 words per line
```

depending on the actual content.

The heading should occupy roughly:

```text
45%–60%
```

of the hero's visual width.

## Avoid

- Huge bold all-caps headings
- Centered hero headings
- Long paragraphs inside the heading
- Gradient text
- Text shadows

---

# 11. Hero Supporting Content

If supporting content is necessary, keep it extremely short.

Recommended:

```text
max-width: 320px–400px
font-size: 14px–16px
line-height: 1.5
```

The supporting text should never compete with the headline.

If the page does not require supporting text, remove it completely.

Minimalism is preferred.

---

# 12. Hero CTA Treatment

The reference does not depend on large button-heavy hero UI.

Therefore, use a **minimal CTA strategy**.

Preferred:

```text
Explore →
Learn More →
View Collection →
Get Started →
```

Style:

- Plain text
- Small arrow
- No large pill
- No giant filled button
- Minimal border if a button is required

Example:

```css
.hero-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
```

Arrow animation:

```text
translateX(0)
→
translateX(4px)
```

Duration:

```text
180ms–220ms
```

If a strong conversion CTA is required by the website, use **one** compact button rather than multiple competing buttons.

---

# 13. Hero Visual

This is the second defining feature after typography.

## Visual Philosophy

Do not automatically use a standard full-width photograph.

Prefer:

1. Cut-out product imagery
2. Transparent PNG/WebP objects
3. Carefully cropped photography
4. 3D renders
5. Editorial product compositions
6. Architectural details
7. Large isolated objects

The visual should feel like an art-directed object placed on the page.

## Visual Shape

Prefer:

```text
irregular / organic / cut-out
```

over:

```text
large rounded rectangular card
```

## Image Treatment

- Natural colors
- Sharp details
- No heavy filters
- No dark overlays
- No gradients
- No excessive border
- No default rounded corners

Use:

```css
object-fit: contain;
```

for isolated objects.

Use:

```css
object-fit: cover;
```

only when using editorial photography.

---

# 14. Visual Scale

The hero visual should be large enough to create tension with the typography.

Recommended desktop size:

```text
width: 34%–48vw
max-width: 620px
```

The visual may intentionally exceed its grid boundary.

Recommended position:

```text
right: 2%–8%
top: 18%–30%
```

Avoid making the visual perfectly centered in its column.

---

# 15. Image / Object Cropping

The visual may be cropped by the viewport.

This is encouraged when appropriate.

Example:

```text
The object can partially exit the right edge.
```

This produces the same editorial confidence as the reference.

However:

- Never crop the important subject
- Maintain accessible alt text
- Ensure mobile content remains fully understandable

---

# 16. Editorial Decorative Element

The screenshot's unusual visual personality can be recreated with **one small art-directed detail**.

Possible elements:

- Small arrow
- Handwritten note
- Tiny label
- Organic shape
- Small accent mark
- Subtle line
- Floating micro-caption

Use only one or two.

Example:

```text
small note
      ↗
```

## Styling

```text
font-size: 10px–14px
color: var(--color-text-muted)
```

Optional accent:

```text
color: var(--color-accent)
```

Do not use decorative elements throughout the entire page.

---

# 17. Background Treatment

The background should remain predominantly white.

Unlike the previous design direction, **do not use a prominent dotted architectural grid**.

The reference depends on a clean uninterrupted background.

Use:

```css
background: #FFFFFF;
```

Optional:

```css
background: #FAFAF9;
```

for selected sections.

## Avoid

- Large gradients
- Dotted backgrounds covering the hero
- Heavy textures
- Pattern overlays
- Noise textures
- Large abstract SVG backgrounds

The empty white space is the texture.

---

# 18. Section 2 — Main Content Introduction

After the hero, introduce the first major content section with the same editorial discipline.

Recommended layout:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│ SMALL LABEL                                                   │
│                                                              │
│ Large section heading                Short supporting copy   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Do not immediately introduce a grid of cards.

Allow the typography to establish the next visual rhythm.

---

# 19. Editorial Content Sections

Each major section should use one of three layouts.

## Layout A — Text Left / Visual Right

```text
TEXT                         VISUAL
Large heading                Large image
Short description            or product
Small link
```

## Layout B — Visual Left / Text Right

```text
VISUAL                       TEXT
Large image                  Small label
                             Large heading
                             Description
                             Link
```

## Layout C — Full-Width Editorial Image

```text
────────────────────────────────────────────────
              LARGE VISUAL
────────────────────────────────────────────────

Small caption
Short heading
```

Alternate these layouts to create visual rhythm.

---

# 20. Product Categories

If the website contains product categories, do not display them as conventional SaaS cards.

Use editorial image blocks.

Recommended:

```text
┌──────────────────────┐   ┌────────────────────────┐
│                      │   │                        │
│      LARGE IMAGE     │   │       LARGE IMAGE      │
│                      │   │                        │
└──────────────────────┘   └────────────────────────┘

Category name →             Category name →
```

## Category Design

- Flat composition
- No card shadow
- No rounded container
- Large image
- Small category label
- Large but restrained title
- Arrow/text link

## Hover

Image:

```text
scale(1.00) → scale(1.025)
```

Text:

```text
arrow moves 3–5px
```

Duration:

```text
400ms–500ms
```

---

# 21. Product Showcase

Use an editorial product presentation instead of a card carousel.

Structure:

```text
SMALL LABEL

Large product image

Product name
One-line description

Explore →
```

The image should dominate the section.

Keep supporting text secondary.

---

# 22. Brand / Story Section

Use a large typographic statement.

Example structure:

```text
SMALL LABEL

Large statement about the company,
product, craftsmanship, or purpose.

                    Short supporting paragraph
                    and text link →
```

The section should feel closer to an editorial magazine spread than a marketing card.

---

# 23. Gallery

If a gallery is required, use an art-directed grid.

Do not make every image the same size.

Recommended:

```text
┌───────────────┐ ┌─────────────────────────┐
│               │ │                         │
│    IMAGE      │ │          IMAGE          │
│               │ │                         │
└───────────────┘ └─────────────────────────┘

┌────────────────────────────┐ ┌────────────┐
│                            │ │            │
│            IMAGE           │ │   IMAGE    │
│                            │ │            │
└────────────────────────────┘ └────────────┘
```

Use varying proportions.

Keep gutters small but visible:

```text
8px–20px
```

The gallery should feel curated, not like a photo dump.

---

# 24. Image Captions

Use very small captions.

Example:

```text
PROJECT / LOCATION / CATEGORY
```

Style:

```text
font-size: 9px–11px
letter-spacing: 0.08em
color: var(--color-text-light)
```

Captions should sit close to their corresponding image.

---

# 25. Quote / Conversion Section

The conversion section should maintain the minimalist visual language.

Avoid a giant red CTA block.

Preferred:

```text
────────────────────────────────────────────

Small label

Large question / invitation

Short supporting statement

Request a Quote →

────────────────────────────────────────────
```

Use the brand's actual content.

The CTA can use:

- Dark text
- Small arrow
- Minimal button
- Thin border

If a filled button is necessary:

```text
background: #111111
color: #FFFFFF
border-radius: 0–2px
```

---

# 26. Footer

The footer should remain lightweight.

Recommended structure:

```text
Brand                         Navigation
                              Products
                              Company
                              Support

Contact / social              Legal
```

Use small typography.

Avoid a massive dark footer unless the site's content genuinely requires it.

## Footer Styling

```text
background: #FFFFFF
border-top: 1px solid #E8E8E8
```

Optional:

```text
background: #111111
color: #FFFFFF
```

If using a dark footer, keep the structure simple and editorial.

---

# 27. Mobile Layout

The mobile design must preserve the **visual hierarchy**, not the desktop geometry.

## Mobile Order

```text
Header
↓
Whitespace
↓
Eyebrow
↓
Large heading
↓
Supporting text
↓
Minimal CTA
↓
Large visual
↓
Next section
```

## Mobile Hero

Use:

```text
padding-top: 64px–88px
padding-bottom: 64px–80px
```

The visual should appear beneath the headline.

Do not place text and visual side-by-side on small screens.

## Mobile Typography

```text
Hero: 42px–56px
Section: 36px–46px
Body: 14px–16px
Navigation: 11px–12px
Eyebrow: 8px–10px
```

## Mobile Visual

Use:

```text
width: 80%–100%
max-width: 420px
margin-left: auto
```

Allow a slight horizontal offset.

---

# 28. Mobile Header

Structure:

```text
┌──────────────────────────────────────┐
│ Brand                         Menu   │
└──────────────────────────────────────┘
```

The header remains minimal.

Use a simple menu icon.

Avoid:

- Large hamburger panels with excessive decoration
- Pill-shaped menu controls
- Full-screen animated transitions unless necessary

The mobile navigation panel should use the same typography and whitespace system.

---

# 29. Desktop Breakpoints

## Large Desktop — ≥ 1440px

Use:

- Very large hero typography
- Maximum whitespace
- Large visual object
- Wide editorial container
- Compact navigation

## Desktop — 1200–1439px

Use:

- Large heading
- Two-column hero
- Large visual
- Full navigation

## Tablet — 768–1199px

Use:

- Reduced heading
- Slightly smaller visual
- Reduced spacing
- Maintain left alignment
- Keep editorial composition

## Mobile — < 768px

Use:

- Single-column layout
- Headline first
- Visual second
- Compact header
- Minimal CTA
- Reduced section spacing

---

# 30. Spacing System

Use:

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

## Recommended Section Spacing

Desktop:

```text
112px–160px
```

Tablet:

```text
80px–120px
```

Mobile:

```text
72px–96px
```

The exact spacing should vary by section.

Do not make every section identical in height.

---

# 31. Border & Radius System

The screenshot uses an almost completely flat interface.

Use:

```text
Images: 0px–2px
Buttons: 0–3px
Inputs: 0–3px
Cards: 0–4px
```

Prefer square or nearly square geometry.

Avoid:

```text
border-radius: 20px;
border-radius: 9999px;
```

Do not use rounded cards as the default design language.

---

# 32. Shadows

Use almost no shadow.

Preferred:

```css
box-shadow: none;
```

Only use a subtle shadow when required for:

- Mobile navigation
- Modal dialogs
- Dropdown menus
- Floating controls

Example:

```css
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
```

---

# 33. Motion & Interaction

The animation philosophy should be **quiet and editorial**.

## Navigation

```text
150–200ms
```

## Links

```text
180–220ms
```

## Image reveals

```text
400–700ms
```

## Hero entrance

Recommended:

```text
opacity: 0 → 1
transform: translateY(12px) → translateY(0)
```

Stagger:

```text
eyebrow
↓
headline
↓
supporting text
↓
CTA
↓
visual
```

Do not use large bouncing or elastic animations.

---

# 34. Scroll Behavior

Use subtle reveal animations.

Example:

```text
section enters viewport
↓
content fades in
↓
content moves 8–16px upward
```

The animation should feel like content naturally entering the page.

Avoid:

- Parallax on every element
- Excessive horizontal scrolling
- Scroll-jacking
- Continuous floating animations

---

# 35. Image Hover

Use restrained image movement.

Default:

```text
scale(1)
```

Hover:

```text
scale(1.025)
```

Transition:

```css
transition: transform 500ms ease;
```

Use:

```css
overflow: hidden;
```

only when the image is contained within a crop.

---

# 36. Buttons & Links

## Primary CTA

Prefer a compact dark button when a real button is required.

```text
Background: #111111
Text: #FFFFFF
Height: 42px–48px
Padding: 0 18px–22px
Radius: 0–2px
Font size: 11px–13px
```

## Secondary CTA

Prefer a text link:

```text
Explore →
```

or:

```text
Learn More →
```

## Hover

Use:

```text
background shift
or
arrow movement
```

Do not use dramatic transforms.

---

# 37. Forms

Forms should match the editorial style.

Avoid:

- Large rounded inputs
- Heavy shadows
- Colorful fields
- Card-contained forms

Use:

```text
White background
Thin gray border
Square corners
Compact labels
Clear focus state
```

Example:

```text
First Name
────────────────────────────

Last Name
────────────────────────────

Email
────────────────────────────

Message
────────────────────────────

Send →
```

The form should feel like a simple editorial document.

---

# 38. Accessibility

The minimalist design must still be fully accessible.

Requirements:

- WCAG-conscious contrast
- Semantic HTML
- Proper heading hierarchy
- Descriptive image alt text
- Keyboard navigation
- Visible focus indicators
- Actual links/buttons for interactive controls
- Do not rely solely on color
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

# 39. Performance

Because the design relies heavily on large visual assets:

- Use WebP or AVIF
- Use responsive image sizes
- Lazy-load below-the-fold images
- Prioritize the primary hero visual
- Define image dimensions
- Avoid unnecessarily large source files
- Use `object-fit` appropriately
- Avoid unnecessary animation libraries

For Next.js:

```tsx
<Image
  src="/images/hero.webp"
  alt="Descriptive image of the website's actual subject"
  fill
  priority
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

# 40. Technology

Recommended implementation:

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

Keep the visual system in reusable tokens.

---

# 41. Tailwind Design Tokens

Suggested:

```js
colors: {
  background: "#FFFFFF",
  surface: "#F8F8F6",
  foreground: "#171717",
  muted: "#777777",
  light: "#A0A0A0",
  border: "#E8E8E8",
  dark: "#111111",
  accent: "#D96C92",
  accentSoft: "#F3D7E1"
}
```

Typography should be controlled through reusable classes.

Example:

```text
hero-title
section-title
eyebrow
body-copy
micro-label
editorial-link
```

Avoid scattering arbitrary font sizes throughout components.

---

# 42. Recommended Component Architecture

If implementing with React/Next.js:

```text
components/
├── Header/
│   ├── Header.tsx
│   ├── DesktopNav.tsx
│   ├── MobileNav.tsx
│   └── SocialLinks.tsx
│
├── Hero/
│   ├── Hero.tsx
│   ├── HeroEyebrow.tsx
│   ├── HeroContent.tsx
│   ├── HeroVisual.tsx
│   └── HeroLink.tsx
│
├── EditorialSection/
│   ├── EditorialSection.tsx
│   └── EditorialMedia.tsx
│
├── ProductCategories/
│   ├── ProductCategories.tsx
│   └── CategoryItem.tsx
│
├── ProductShowcase/
│   ├── ProductShowcase.tsx
│   └── ProductVisual.tsx
│
├── Gallery/
│   └── EditorialGallery.tsx
│
├── Conversion/
│   └── ConversionSection.tsx
│
└── Footer/
    └── Footer.tsx
```

The component structure should support the design without forcing every section into a card component.

---

# 43. Suggested Page Structure

```tsx
<App>
  <Header />

  <main>
    <Hero />

    <EditorialIntro />

    <ProductCategories />

    <BrandStory />

    <FeaturedProducts />

    <EditorialGallery />

    <ConversionSection />
  </main>

  <Footer />
</App>
```

The content should remain based on the existing website. Only the presentation and composition are being redesigned.

---

# 44. Hero Component Requirements

The hero should support the existing website content while allowing the new visual treatment.

```ts
type HeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  visual: {
    src: string;
    alt: string;
  };
  visualPosition?: "left" | "right";
};
```

The visual should be independent from the text so that different product/content imagery can be substituted without changing the layout.

---

# 45. Design Rules for Images

Every image should have a clear purpose.

## Preferred

- Product-focused
- Architecture-focused
- Detail-focused
- Human interaction
- Strong composition
- Clean background
- High resolution

## Avoid

- Generic stock-photo collages
- Heavy filters
- Multiple competing hero images
- Repeated identical image proportions
- Large image cards with excessive UI
- Decorative images that communicate nothing

The hero should generally have **one dominant visual** rather than a four-image collage.

---

# 46. Visual Hierarchy

The viewer's eye should generally move in this order:

```text
1. Brand / Logo
        ↓
2. Tiny eyebrow
        ↓
3. Large hero headline
        ↓
4. Dominant visual object
        ↓
5. Supporting text / CTA
        ↓
6. Next editorial section
        ↓
7. Product / service imagery
        ↓
8. Brand story
        ↓
9. Conversion
        ↓
10. Footer
```

The first screen should communicate the site's primary value proposition within approximately **3–5 seconds**.

---

# 47. Reference-Specific Details to Preserve

The following visual characteristics are the most important parts of the supplied screenshot and should guide implementation.

## 1. Tiny Header

The navigation occupies very little visual space.

## 2. Small Brand Mark

The logo/wordmark is compact and understated.

## 3. Huge Thin Headline

The headline is the dominant typographic object.

## 4. Left-Aligned Composition

The hero text is positioned toward the left rather than centered.

## 5. Large White Canvas

White space surrounds the content.

## 6. One Oversized Visual

A single object/image provides visual personality on the right.

## 7. Limited Color

The page is primarily black/gray on white with one optional accent.

## 8. Minimal UI

There are few visible controls and almost no decorative containers.

## 9. Small Utility Icons

Tiny icons can occupy the upper-right header area.

## 10. Editorial Proportion

The page should look deliberately composed rather than generated from a standard website template.

---

# 48. What Must NOT Be Copied From the Screenshot

The screenshot is a design reference only.

Do not copy:

- Its exact wording
- Its brand name
- Its logo
- Its specific graphic/object
- Its exact social links
- Its exact content hierarchy if it conflicts with the website's actual content
- Its exact colors when they do not fit the website brand
- Its exact images
- Its exact illustrations
- Its exact dimensions
- Any proprietary visual assets

Use the screenshot to guide **style, spacing, typography, composition, and visual restraint**.

---

# 49. Do / Don't

## DO

- Use a white canvas
- Use large editorial typography
- Keep navigation tiny
- Keep the logo small
- Use one dominant hero visual
- Use generous whitespace
- Use left-aligned hero content
- Use thin/regular typography
- Use subtle micro-labels
- Use minimal CTA treatment
- Use restrained accent color
- Use sharp or nearly square geometry
- Use curated imagery
- Use subtle motion
- Keep the composition visually balanced

## DON'T

- Use large rounded cards
- Use giant gradients
- Use excessive shadows
- Use multiple competing hero images
- Center everything
- Use huge bold typography everywhere
- Use giant CTA buttons
- Use colorful navigation
- Fill every empty space
- Use generic SaaS dashboard aesthetics
- Use excessive decorative patterns
- Overuse animation
- Turn every section into a card grid
- Copy the screenshot's content

---

# 50. Final Design Goal

The completed website should feel like:

> **A minimalist, editorial, art-directed website where typography and one strong visual create the experience.**

It should not feel like:

> **A generic service-business template, SaaS landing page, or card-heavy marketing website.**

The most important design decision is the combination of:

**large thin typography + compact navigation + expansive white space + one dominant visual + restrained color + editorial composition.**

The screenshot should be treated as a **visual language reference**, not a content reference.

---

# 51. Implementation Checklist

## Header

- [ ] Compact header
- [ ] Small logo/wordmark
- [ ] Small navigation typography
- [ ] Minimal utility/social icons
- [ ] No oversized CTA
- [ ] Mobile menu
- [ ] Subtle hover states

## Hero

- [ ] Large thin editorial headline
- [ ] Small eyebrow
- [ ] Left-aligned composition
- [ ] Large white space
- [ ] One dominant visual
- [ ] Minimal CTA/link
- [ ] No copied screenshot content
- [ ] Responsive visual positioning

## Content

- [ ] Editorial introduction
- [ ] Image-led product/category sections
- [ ] Alternating text/image layouts
- [ ] Large typography
- [ ] Curated gallery
- [ ] Minimal metadata

## Footer

- [ ] Compact navigation
- [ ] Contact information
- [ ] Social links
- [ ] Legal links
- [ ] Minimal visual treatment

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
- [ ] Hero visual priority
- [ ] Font optimization
- [ ] Layout-shift prevention

---

# 52. One-Sentence Design Brief

**Create a minimalist editorial website with a compact header, oversized thin typography, generous white space, a left-aligned hero composition, one large art-directed visual on the right, subtle monochrome UI, restrained accent color, and carefully controlled motion—using the supplied screenshot only as inspiration for visual style and not for its content.**
