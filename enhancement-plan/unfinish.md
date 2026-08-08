# TaskMind Dashboard Redesign — Detailed Implementation Plan

## 1. Design Token System (Pass 1)

### Color Strategy
**Approach:** Semantic color layering that separates brand, data, and UI layers without clashing.

- **Brand Layer:** Single confident accent used exclusively for the logo, primary actions, and the signature "settling" moment. This sits apart from all functional colors.
- **Data Layer:** The existing urgency semantics (green/amber/red) remain untouched — these are information, not decoration. They're applied consistently to urgency indicators, deadlines, and priority labels.
- **Surface Layer:** A calm, neutral paper tone (neither stark white nor warm cream) provides the canvas. A darker ink color handles text.
- **UI Layer:** Subtle dividers, backgrounds, and interactive states use a restrained secondary palette that doesn't compete with brand or data colors.

**Against Generic AI Traps:**
- ❌ Not cream-background/serif/terracotta — we're avoiding the expected warm/earthy combination
- ❌ Not near-black-with-neon-accent — no cold contrast or aggressive highlights
- ❌ Not hairline-broadsheet-newspaper — no editorial pretension

### Typography
- **Display Face:** Used only for the logo, major section headers (1-2 per page), and the "settled" confirmation moment. Should have genuine character without being decorative.
- **Body Sans:** Workhorse face for all UI text, settings, labels, and descriptions. Highly legible at all sizes.
- **Data Face:** A monospace or tabular-figure face for deadlines, timestamps, confidence scores, and urgency labels. Creates the contrast between "fuzzy human input" and "machine-precise output."

**The Personality Hook:** The expressive display face vs. mechanical data face creates the product's visual tension — human language on one side, algorithmic clarity on the other.

### Signature Element: "The Settling"
A single, purposeful transition that plays once per analysis session:

1. Raw pasted text sits in the input area
2. User triggers analysis → the text visibly **resolves** into structured data
3. Actions highlight in brand color, deadlines shift to monospace, urgency labels appear
4. A subtle scan-line effect sweeps from top to bottom (1-1.5s duration)
5. The resolved content expands into the results panel below

**Motion Principles:**
- Happens once per session, not looping
- Clear beginning, middle, and end
- Encodes "clarity" through literal visual transformation
- Respects `prefers-reduced-motion` (falls back to instant rendering)

---

## 2. Self-Critique Against Generic AI Patterns (Pass 2)

**Original plan review:** The color approach was heading toward a muted, warm palette that could easily drift into "cream-background/terracotta" territory. The typography plan avoided the obvious serif pairing but still needed sharper differentiation.

**Changes made:**
1. **Shifted color emphasis** — Instead of a warm/earthy base, we're using a cooler neutral surface with warmth only in the brand accent. This avoids the predictable "AI tool warmth" trend.
2. **Strengthened the data face** — Made the monospace/data face more prominent in the visual hierarchy. It's not just for dates — it appears on urgency badges, confidence scores, and status indicators. This mechanical precision contrast is our differentiator.
3. **Reduced display face usage** — Limited to even fewer moments (just logo + one header per page + the "settled" state). Overuse would drift toward generic editorial styling.
4. **Clarified the signature element** — Made it explicitly a one-time transition rather than a persistent animation. This prevents the "ambient motion for polish" trap.

**What makes this unique:** Most AI tools either go full editorial (serif, warm, "thoughtful") or full tech (mono, cold, "precise"). TaskMind sits in between — human input, machine output — and the typography + signature animation literally visualizes that transformation.

---

## 3. ASCII Wireframes

### Desktop Layout (≥1024px)

```
┌──────────┬─────────────────────────────────────┬──────────────┐
│          │                                      │              │
│ SIDEBAR  │           MAIN CONTENT              │  ADS RAIL    │
│ (240px)  │                                      │  (25% vw)    │
│          │  ┌──────────────────────────────┐   │              │
│ Logo     │  │  INPUT AREA                  │   │  [Ad Unit]   │
│          │  │  [Paste text / Upload]       │   │              │
│ Nav:     │  │  [Analyze →] button          │   │  [Ad Unit]   │
│  • New   │  └──────────────────────────────┘   │              │
│  • Hist  │                                      │              │
│  • Saved │  ┌──────────────────────────────┐   │              │
│  • Dash  │  │  RESULTS PANEL               │   │              │
│  • Set   │  │  ┌───┬───┬───┬───┬───┐      │   │              │
│          │  │  │ A │ D │ U │ C │ N │      │   │              │
│ Account  │  │  └───┴───┴───┴───┴───┘      │   │              │
│ [Upgrade]│  │                              │   │              │
│          │  │  • Actions list              │   │              │
│ Sticky   │  │  • Deadlines w/ .ics export  │   │              │
│          │  │  • Urgency indicators        │   │              │
│ Collapse │  │  • Confusing parts           │   │              │
│ to icon  │  │  • Next step recommendation  │   │              │
│          │  └──────────────────────────────┘   │              │
│          │                                      │              │
└──────────┴─────────────────────────────────────┴──────────────┘
```

**Key Details:**
- Sidebar: Fixed width, sticky, collapsible to icon-only rail (48px) on user toggle or narrow desktop
- Main Content: Flexible width, contains both input + results vertically
- Ads Rail: Exactly 25% of viewport, sticky, labeled "Sponsored", lazy-loaded, no layout shift

### Mobile Layout (<1024px)

```
┌────────────────────────────┐
│                             │
│      MAIN CONTENT           │
│      (Full width)           │
│                             │
│  ┌──────────────────────┐  │
│  │  INPUT AREA           │  │
│  │  [Paste text / Upload]│  │
│  │  [Analyze →] button   │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │  RESULTS PANEL        │  │
│  │  • Actions            │  │
│  │  • Deadlines          │  │
│  │  • Urgency            │  │
│  │  • Confusing parts    │  │
│  │  • Next step          │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │  ADS BLOCK            │  │
│  │  [Ad Unit - optional] │  │
│  └──────────────────────┘  │
│                             │
├────────────────────────────┤
│  [New] [Hist] [Saved] [Set]│ ← Bottom Nav (app-style)
└────────────────────────────┘
```

**Key Details:**
- No sidebar — replaced with bottom navigation bar (icon + label, current route highlighted)
- Ads either drop below results as a contained block or omitted entirely
- Full-width single-column content
- Breakpoint defined at 1024px (matches desktop grid threshold)
- No hamburger menu — genuinely becomes bottom nav

---

## 4. Implementation Plan

### Phase 1: Core Architecture & Layout
1. **Routing Structure** (Next.js 14 App Router):
   - `/` → Dashboard (new landing, not placeholder)
   - `/dashboard` → Redirect to `/`
   - `/history` → History view with search/filter
   - `/saved` → Saved templates
   - `/settings` → Settings (light/dark toggle, etc.)
   - `/analysis/[id]` → Individual result view (shareable)

2. **Layout Components**:
   - `DashboardLayout` — Desktop: sidebar + main + rail | Mobile: main + bottom nav
   - Breakpoint at 1024px with clean transition (no intermediate state)
   - Bottom nav for mobile: New Analysis, History, Saved, Settings

3. **State Management**:
   - React Context for: current analysis, history, saved templates
   - localStorage persistence (designed for easy DB migration later)
   - Analysis results: `{ id, timestamp, input, output: { actions, deadlines, urgency, confusingParts, nextStep, summary } }`

### Phase 2: Core Features
1. **Input Area** (reuse/extend existing):
   - Text paste with auto-detect
   - File upload: PDF (pdfjs-dist), DOCX (mammoth), Images (Tesseract.js)
   - Drag-and-drop support
   - Voice input (nice-to-have)

2. **Results Panel** (rebuild with streaming):
   - **Streaming implementation**: Server-sent events or progressive rendering via server actions
   - Show actions/deadlines/urgency appearing progressively
   - The "settling" signature animation triggers once results begin rendering
   - Each section: Actions list, Deadlines with `.ics` export, Urgency indicators (level meter), Confusing parts, Next step recommendation, Summary

3. **History**:
   - List view in sidebar (desktop) / full page (mobile)
   - Search by content, filter by date/urgency
   - Click to load previous analysis results

4. **Saved/Templates**:
   - Save current input as template
   - Apply template to input area with one click

### Phase 3: Enhancement Features
1. **My Actions Board**:
   - Aggregate all `actions` from history into a single view
   - Kanban: To Do / In Progress / Done
   - Drag to reorder/update status

2. **Light/Dark Mode**:
   - Respects token system (both modes feel designed)
   - System preference + manual toggle
   - Smooth transition

3. **Shareable Links**:
   - Generate read-only link for any analysis
   - Route: `/share/[id]`

4. **Keyboard Shortcuts**:
   - `Cmd/Ctrl+Enter` → Analyze
   - `Esc` → Clear input
   - `Cmd/Ctrl+K` → Quick search (history/templates)

### Phase 4: Polish & Edge Cases
1. **Empty/Loading/Error States**:
   - Written in-voice (direct, useful, no filler)
   - Empty: "Paste or upload something to analyze"
   - Loading: "Turning noise into clarity..." (with progress indicator)
   - Error: "Couldn't analyze that. [specific reason]. Try [specific action]."

2. **Mobile Optimization**:
   - Touch targets ≥44px
   - Bottom nav with active state
   - Input area optimized for mobile keyboard

3. **Performance**:
   - Ad rail lazy-loaded (no layout shift)
   - Code splitting by route
   - Image optimization for any uploaded images

---

## 5. What Changes & Why

### From Current MVP
| Current | New | Why |
|---------|-----|-----|
| Single-page app | Multi-route dashboard | Product needs to become a workspace, not a one-off tool |
| No history | Persistent history with search/filter | Users need to reference past analyses |
| No templates | Saved templates | Recurring inputs are common (weekly reports, meeting notes) |
| Blocking results | Streaming results | Better UX, natural home for signature animation |
| Deadline text only | Deadline actions (`.ics` export) | Actionable output, not just display |
| No mobile nav | Bottom navigation | Proper mobile experience, not squeezed desktop |
| Stub dashboard | Real dashboard with stats | First impression should show value |
| No light/dark | Designed light/dark modes | User preference, accessibility |
| Basic error states | Voice-aligned error states | Clear communication, builds trust |

### Technical Decisions
- **Keep existing stack**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 4
- **Reuse components**: Don't rewrite from scratch — extend `src/components/` and `src/lib/`
- **Preserve pipeline**: OpenRouter + Claude 3.5 Sonnet with multi-key failover, rule-based fallback
- **Client-side parsing**: Keep pdfjs-dist, mammoth, Tesseract.js
- **AdSense**: Keep ads, but now with dedicated 25% rail

### Design Changes
- **From generic AI look** → Distinctive, considered identity
- **From single page** → Dashboard with sidebar + main + rail
- **From blocking** → Streaming with signature animation
- **From desktop-only** → Fully responsive with bottom nav on mobile

---

## 6. Implementation Checklist

### Sprint 1: Foundation
- [ ] Design token system implemented in Tailwind config
- [ ] Layout: Desktop (sidebar + main + rail) + Mobile (bottom nav)
- [ ] Routing structure (/, /history, /saved, /settings, /analysis/[id])
- [ ] State management + localStorage persistence
- [ ] Input area (paste + file upload) reusing existing logic

### Sprint 2: Core Results
- [ ] Results panel with streaming
- [ ] Signature "settling" animation
- [ ] Actions, deadlines, urgency, confusing parts, next step, summary
- [ ] `.ics` export for deadlines
- [ ] Empty/loading/error states

### Sprint 3: History & Templates
- [ ] History list with search/filter
- [ ] Load previous analyses
- [ ] Save/apply templates
- [ ] My Actions board

### Sprint 4: Polish
- [ ] Light/dark mode
- [ ] Shareable links
- [ ] Keyboard shortcuts
- [ ] Mobile optimization
- [ ] Performance optimization (ad rail lazy-loading)
- [ ] Final QA against brief (non-negotiables check)

---

## 7. Non-Negotiables Verification

| Requirement | Implementation Check |
|-------------|---------------------|
| No purple-to-blue gradient | ✅ Using warm brand accent, not gradients |
| No generic rounded-card AI SaaS look | ✅ Distinctive token system, signature element |
| No stock emoji for icons | ✅ Custom icon set or proper SVG icons |
| No looping ambient animation | ✅ Signature element is finite (once per session) |
| No sidebar-on-mobile-hamburger | ✅ Bottom nav on mobile, full stop |
| Ads ≠ product cards visually | ✅ Rail labeled "Sponsored", separate styling |
| 25% ad rail, not squeezed | ✅ Fixed width percentage on desktop |
| Mobile ads not scaled down | ✅ Either below results or omitted entirely |
