# COMPLETE PRODUCTION UI/UX REDESIGN PROMPT

## Primary Objective

Act as a **Senior UI/UX Designer, Senior Frontend Engineer, Design Systems Engineer, and Product Design Specialist**.

Your task is to completely **redesign and polish the existing website's visual interface** by following:

1. The project's `design.md`
2. The UI/UX Pro Max skills and guidelines located inside the project's `.opencode` folder
3. The existing application's current architecture
4. The existing application's content and functionality

The final result must be a **clean, modern, premium, polished, highly usable, responsive, and professional interface**.

This is a **visual/UI/UX redesign task only**.

The application's underlying business logic, content, data, functionality, routes, APIs, and behavior must remain intact.

---

# 1. READ AND STUDY THE DESIGN SOURCES FIRST

Before writing or modifying code, inspect the project thoroughly.

You MUST first locate and read:

```text
design.md
```

and the relevant UI/UX Pro Max skills located inside:

```text
.opencode/
```

Do not begin implementing the redesign until you understand both.

The `design.md` file defines the primary visual direction.

The `.opencode` UI/UX Pro Max skills provide additional professional guidance for:

* UI design
* UX design
* visual hierarchy
* typography
* spacing
* color
* accessibility
* responsive design
* component design
* interaction design
* modern interface patterns
* usability
* visual polish
* design consistency

Use these resources as design authorities.

Do not ignore the existing `design.md` in favor of generic design preferences.

---

# 2. IMPORTANT — INSPECT THE `.OPENCODE` FOLDER

Before implementation:

```text
.opencode/
```

must be inspected.

Identify the available UI/UX Pro Max skills, instructions, references, or design rules.

Read the relevant files completely enough to understand their requirements.

If multiple UI/UX Pro Max skills are relevant, use the appropriate ones together.

Do not simply say that the skills were read.

Actually apply their principles to the implementation.

---

# 3. UNDERSTAND THE EXISTING APPLICATION FIRST

Before redesigning anything, inspect the current project.

Understand:

* framework
* routing
* layouts
* pages
* components
* styles
* Tailwind configuration
* CSS
* design tokens
* images
* fonts
* icons
* state management
* API calls
* server actions
* hooks
* authentication
* authorization
* forms
* validation
* database interactions
* dashboards
* tables
* filters
* search
* pagination
* modals
* dialogs
* dropdowns
* notifications
* loading states
* error states
* empty states
* responsive behavior

Understand what every important page is responsible for before changing its presentation.

---

# 4. ABSOLUTE RULE — DO NOT CHANGE BUSINESS LOGIC

This is NON-NEGOTIABLE.

You are redesigning the UI.

You are NOT rebuilding the application's logic.

Do NOT modify:

* business logic
* calculations
* API behavior
* API endpoints
* database queries
* database schema
* authentication
* authorization
* roles
* permissions
* sessions
* state management
* server actions
* API contracts
* external integrations
* payment logic
* email functionality
* notifications
* upload functionality
* search logic
* filtering logic
* sorting logic
* pagination logic
* CRUD operations
* validation rules
* data transformation
* feature flags
* environment variables
* configuration unrelated to the visual design

If something already works, it must continue working.

---

# 5. DO NOT MODIFY EXISTING CONTENT

Preserve the existing content exactly.

Do not rewrite:

* headings
* titles
* descriptions
* labels
* navigation items
* buttons
* CTAs
* product names
* service names
* statistics
* numbers
* testimonials
* names
* contact details
* legal content
* footer content
* data
* messages
* status labels

You may change how the content is visually presented.

You may:

* change typography
* change spacing
* change alignment
* change hierarchy
* change layout
* change visual grouping
* change component styling

But you must NOT change what the content says.

Do not invent new content.

Do not add fake content.

Do not replace existing content with placeholder content.

---

# 6. DO NOT REMOVE FUNCTIONALITY

Do not remove functionality simply because the new design is minimalist.

If the application contains:

* filters
* search
* forms
* tables
* dashboards
* authentication
* navigation
* tabs
* modals
* dialogs
* dropdowns
* CRUD controls
* account controls
* notifications
* pagination
* sorting
* upload controls

keep them.

The goal is:

```text
Same functionality
+
Same content
+
Same business logic
+
Much better UI/UX
```

---

# 7. CORE VISUAL DIRECTION

The `design.md` establishes the following visual personality:

```text
Minimal
Editorial
Creative
Modern
Elegant
Playful
Confident
Spacious
Lightweight
Premium
Human
Art-directed
Uncluttered
```

The final website should strongly communicate these characteristics.

The design should feel:

> Like a professionally art-directed modern website.

It should NOT feel like:

> A generic SaaS template.

It should NOT feel like:

> A collection of random UI components.

It should NOT feel like:

> A default Tailwind/Next.js website.

---

# 8. VERY IMPORTANT — MAIN DASHBOARD MUST BE CLEAN AND BORDERLESS

This is one of the most important requirements.

For the **main dashboard page**, avoid the traditional dashboard appearance of:

```text
┌──────────────┐
│ Card         │
│              │
└──────────────┘

┌──────────────┐
│ Card         │
│              │
└──────────────┘
```

Do NOT make the main dashboard look like a collection of boxed widgets.

Avoid excessive:

* borders
* cards
* containers
* shadows
* rounded boxes
* outlined panels
* floating UI blocks

Instead, create a **flat, spacious, editorial dashboard composition**.

Use:

```text
Typography
Whitespace
Alignment
Spacing
Subtle dividers only when necessary
Visual hierarchy
Clean icons
Numbers
Simple metadata
```

to establish structure.

---

# 9. DASHBOARD DESIGN PHILOSOPHY

The main dashboard should feel:

**clean + premium + calm + organized + effortless**

Instead of:

```text
[ CARD ] [ CARD ] [ CARD ]
[ CARD ] [ CARD ] [ CARD ]
[ CARD ] [ CARD ] [ CARD ]
```

prefer compositions like:

```text
Dashboard

Overview
Simple supporting text

Large number       Large number       Large number
Label              Label              Label

────────────────────────────────────────────

Recent Activity

Icon   Activity name                  Time
Icon   Activity name                  Time
Icon   Activity name                  Time
```

The structure should be created through:

* whitespace
* typography
* alignment
* subtle separators
* column relationships
* iconography

rather than boxes.

---

# 10. DASHBOARD HEADINGS MUST BE STRONG

For dashboard headings and major section titles:

Use **bold or semibold typography**.

Examples of hierarchy:

```text
Dashboard
```

should be visually strong.

Then:

```text
Overview
Recent Activity
Quick Actions
Performance
```

should have clear hierarchy.

Supporting content should remain simple.

For example:

```text
Dashboard
Your current overview

```

The title should be strong.

The supporting text should be lightweight.

---

# 11. TYPOGRAPHY RULE

Use typography intentionally.

### Headings / Titles

Use:

```text
font-weight: 600
font-weight: 650
font-weight: 700
```

depending on hierarchy.

Major dashboard headings should feel confident and clear.

### Supporting text

Use:

```text
font-weight: 400
```

Keep descriptions simple and readable.

### Metadata

Use:

```text
font-weight: 400–500
```

with muted colors.

The overall hierarchy should be:

```text
TITLE
↓
SECTION HEADING
↓
SUPPORTING TEXT
↓
METADATA
```

Do not make every piece of text bold.

---

# 12. DO NOT OVERUSE BOLD TEXT

Bold typography is for hierarchy.

Do not turn every label into bold text.

Use:

**Bold**

for:

* page titles
* major headings
* important values
* important labels

Use regular/simple typography for:

* descriptions
* supporting information
* metadata
* secondary labels
* helper text

This creates contrast and makes the interface easier to scan.

---

# 13. CLEAN MODERN ICONS

Use clean, modern, professional icons throughout the interface.

Preferred icon style:

* minimal
* line-based
* geometric
* consistent stroke
* simple
* recognizable
* modern
* small to medium size

If the project already uses **Lucide React**, prefer it.

Otherwise, use the existing icon system or an appropriate modern icon library already available in the project.

Do not introduce multiple icon libraries unnecessarily.

Avoid:

* oversized icons
* colorful cartoon icons
* inconsistent icon styles
* heavy filled icons
* unnecessary icon containers
* giant circular backgrounds
* decorative icons that have no purpose

Icons should support understanding, not become decoration.

---

# 14. ICON CONTAINER RULE

Do not automatically put icons inside:

```text
circle
rounded square
card
gradient box
colored bubble
```

Instead, whenever appropriate, use the icon directly beside the content.

Example:

```text
↗ Revenue
₱125,000
```

or:

```text
[icon] Recent Orders
```

rather than:

```text
┌─────────────────┐
│   [ICON BOX]    │
│                 │
│ Revenue         │
│ ₱125,000        │
└─────────────────┘
```

Keep the interface visually lightweight.

---

# 15. COLOR SYSTEM

Follow the design tokens defined in `design.md`.

Primary:

```text
Background: #FFFFFF
Surface: #F8F8F6
Text: #171717
Muted: #777777
Light: #A0A0A0
Border: #E8E8E8
Dark: #111111
Accent: #D96C92
Accent Soft: #F3D7E1
```

However:

**Do not force the accent color everywhere.**

The interface should remain primarily:

```text
Black
Charcoal
Gray
White
```

with a restrained accent.

---

# 16. BORDER RULE

Borders should be used sparingly.

Especially on the main dashboard:

**Avoid borders wherever spacing and typography can establish hierarchy.**

Do NOT add borders simply because a component needs visual separation.

Instead consider:

* spacing
* typography
* alignment
* background changes
* subtle dividers
* whitespace

Use borders only when they materially improve usability.

---

# 17. CARD RULE

Cards are NOT the default design language.

Do not convert everything into cards.

Avoid:

```text
rounded-xl
rounded-2xl
shadow-lg
border
p-6
```

for every component.

If a card is functionally necessary, make it visually subtle.

Prefer:

```text
flat
minimal
sharp/nearly-square
low contrast
little/no shadow
```

The design specification explicitly recommends avoiding large rounded cards and excessive shadows.

---

# 18. SPACING SHOULD CREATE STRUCTURE

When removing borders and boxes, spacing becomes extremely important.

Use whitespace to create hierarchy.

Use the spacing system:

```text
4
8
12
16
24
32
48
64
80
96
120
160
```

Do not randomly use:

```text
13px
27px
39px
57px
83px
```

unless there is a strong design reason.

Create rhythm.

---

# 19. MAIN DASHBOARD STRUCTURE

Redesign the main dashboard around information hierarchy.

A preferred visual structure is:

```text
Page title
Simple supporting description

Large whitespace

Primary metrics
Large values
Small labels

Large whitespace

Main activity/content
Clean rows
Modern icons
Simple metadata

Large whitespace

Secondary information
```

Do not make everything equal.

Establish a clear primary-to-secondary hierarchy.

---

# 20. METRICS / STATISTICS

If the dashboard contains statistics:

Do not automatically put each metric inside a card.

Instead consider:

```text
Revenue
₱125,000
+12.4%

Orders
1,245
+8.2%

Customers
842
+4.6%
```

Use:

* large numbers
* small labels
* muted supporting information
* clean spacing
* subtle separators if necessary

The data should feel integrated into the page rather than trapped inside boxes.

---

# 21. TABLES

If the dashboard contains tables:

Do not create giant boxed tables.

Use a clean editorial table.

Example:

```text
Recent Transactions

Item                  Status          Date
────────────────────────────────────────────
Product A             Completed       Aug 20
Product B             Pending         Aug 19
Product C             Completed       Aug 18
```

Use:

* subtle row separators
* clean typography
* whitespace
* compact icons
* clear alignment

Avoid heavy table borders.

---

# 22. ACTIVITY LISTS

For activity feeds:

Prefer:

```text
[icon] User updated profile
       2 minutes ago

[icon] New order received
       15 minutes ago

[icon] Payment completed
       1 hour ago
```

rather than boxed activity cards.

Icons should provide quick visual recognition.

---

# 23. QUICK ACTIONS

If quick actions exist, do not automatically create large cards.

Use compact actions such as:

```text
+ Add Product
→ View Orders
↗ Reports
⚙ Settings
```

with clean icons and subtle hover states.

Preserve the actual action behavior.

---

# 24. HEADER

The global header should remain compact.

Use:

* small logo
* clean navigation
* subtle spacing
* simple icons
* no oversized CTA
* no excessive borders
* no heavy shadow

Desktop target:

```text
52px–68px
```

Mobile:

```text
56px–64px
```

---

# 25. HERO

For pages that contain a hero:

Use the editorial composition from `design.md`.

Structure:

```text
Small eyebrow

Large headline

Supporting text

Minimal CTA

                         Dominant visual
```

Use large thin typography and expansive whitespace.

The design specification recommends a left-side content composition with a large visual on the right.

---

# 26. OTHER APPLICATION PAGES

Apply the same visual language across:

* dashboards
* settings
* profile pages
* authentication
* forms
* lists
* details pages
* management pages
* product pages
* reports
* administrative pages

However, do not force the exact landing-page composition everywhere.

Use the same:

* typography
* spacing
* iconography
* colors
* geometry
* interaction style
* visual restraint

while adapting the layout to each page's purpose.

---

# 27. FORMS

Forms should be clean and editorial.

Use:

```text
Label
Input
```

with:

* white background
* subtle border
* square/nearly-square corners
* clean focus state
* simple labels
* generous spacing

Avoid:

* giant rounded fields
* heavy shadows
* colorful inputs
* unnecessary card containers

Do not modify form behavior.

---

# 28. MODALS / DIALOGS

If modals exist:

Keep them minimal.

Use:

* white background
* subtle shadow only where necessary
* square/nearly-square geometry
* clear heading
* simple supporting text
* clean buttons
* sufficient whitespace

Do not make them overly decorative.

---

# 29. DROPDOWNS

Dropdowns should be:

* compact
* clean
* readable
* accessible
* simple

Use subtle shadow only if necessary for separation.

Do not use excessive animation.

---

# 30. RESPONSIVE DESIGN

The redesign must work perfectly across:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px
```

Mobile must NOT simply be a scaled-down desktop.

For mobile:

* single-column layouts
* strong typography
* compact header
* large whitespace
* clear touch targets
* stacked content
* visual before complexity
* no horizontal overflow

The design document requires the mobile hero to place the visual beneath the main text.

---

# 31. MOBILE DASHBOARD

The dashboard should become even cleaner on mobile.

Use:

```text
Page title

Supporting text

Primary metric

Secondary metrics

Activity

Actions
```

Do not create a long wall of boxed cards.

Use vertical rhythm and typography.

---

# 32. ANIMATION

Keep animations subtle and professional.

Use:

```text
150–200ms
```

for navigation.

```text
180–220ms
```

for links.

```text
400–700ms
```

for image reveals.

Preferred entrance:

```text
opacity: 0 → 1
translateY(12px) → translateY(0)
```

Avoid:

* bounce
* elastic effects
* excessive parallax
* constant movement
* scroll hijacking
* dramatic transitions

Respect:

```text
prefers-reduced-motion
```

---

# 33. HOVER STATES

Use subtle feedback.

Examples:

Navigation:

```text
opacity: 0.55 → 1
```

Links:

```text
arrow translateX(0 → 4px)
```

Images:

```text
scale(1 → 1.025)
```

Buttons:

```text
subtle background transition
```

Do not use aggressive transforms.

---

# 34. ACCESSIBILITY

Maintain:

* semantic HTML
* correct heading hierarchy
* accessible contrast
* keyboard navigation
* visible focus states
* descriptive alt text
* proper buttons
* proper links
* accessible forms
* reduced-motion support

Never remove accessibility features to achieve a minimalist appearance.

---

# 35. PERFORMANCE

Do not introduce unnecessary dependencies.

Prefer:

* CSS transitions
* existing animation utilities
* Next.js Image
* optimized images
* responsive images
* lazy loading
* optimized fonts

Do not add a large animation library for simple animations.

---

# 36. DESIGN SYSTEM ARCHITECTURE

Create reusable design tokens for:

```text
colors
typography
spacing
containers
borders
radii
transitions
```

Use reusable classes/components where appropriate.

Do not scatter arbitrary styling values throughout the codebase.

---

# 37. CLEAN ICON SYSTEM

Standardize the icon system across the entire project.

Icons must have consistent:

* stroke width
* size
* visual weight
* alignment
* spacing

Use modern line icons.

Recommended:

```text
Lucide
```

if already installed or appropriate for the existing project.

Do not use icons purely for decoration.

Every icon should either:

* communicate meaning
* identify an action
* improve scanning
* support navigation

---

# 38. VISUAL HIERARCHY

The user should immediately understand:

```text
What page am I on?
↓
What is important?
↓
What can I do?
↓
What information matters?
↓
What is secondary?
```

Use:

**Bold typography** for primary headings and titles.

Use **simple regular text** for supporting information.

Use muted text for metadata.

Use icons to support scanning.

Use whitespace to separate conceptual groups.

---

# 39. DO NOT MAKE EVERYTHING LOOK THE SAME

Consistency does NOT mean repetition.

Do not make:

* every section a card
* every section the same height
* every heading the same size
* every component bordered
* every action a button
* every icon inside a circle

Create hierarchy and rhythm.

---

# 40. REMOVE VISUAL NOISE

During the redesign, actively identify and remove unnecessary visual noise.

Examples:

* unnecessary borders
* excessive shadows
* excessive rounded corners
* gradients
* decorative backgrounds
* redundant labels
* oversized icons
* unnecessary containers
* duplicate buttons
* excessive badges
* excessive color
* excessive animation

The goal is not to add more design.

The goal is to make the existing design **more intentional**.

---

# 41. IMPORTANT DASHBOARD RULE

For the **main dashboard page**, remember these rules above everything else:

### DO

* use whitespace
* use bold page titles
* use simple supporting text
* use large readable metrics
* use clean modern icons
* use flat layouts
* use subtle separators only when necessary
* use typography to establish hierarchy
* use alignment to establish structure
* use clean rows for lists
* use restrained color
* create a premium editorial feeling

### DO NOT

* create a grid of boxed cards
* put every metric inside a bordered container
* use excessive borders
* use giant rounded corners
* use heavy shadows
* use colorful card backgrounds
* use gradients everywhere
* use oversized icon circles
* make every element look like a floating widget

The dashboard should feel **open, clean, spacious, and sophisticated**.

---

# 42. DO NOT SACRIFICE USABILITY

Minimalism does not mean hiding important functionality.

Never sacrifice:

* discoverability
* readability
* accessibility
* navigation
* feedback
* error visibility
* form usability
* action clarity

If removing a border makes something harder to understand, use a subtle separator or background change.

The goal is **minimalism with excellent UX**, not minimalism at the expense of usability.

---

# 43. VISUAL QA

After implementation, inspect the entire application.

Check:

## Typography

* headings are strong
* titles are bold/semibold
* supporting text is simple
* typography is consistent
* line lengths are readable

## Layout

* spacing is generous
* alignment is intentional
* pages do not feel cramped
* dashboard does not feel boxed in

## Icons

* consistent
* modern
* clean
* properly sized
* properly aligned

## Dashboard

* minimal borders
* minimal boxes
* strong title
* clear metrics
* clean activity
* excellent whitespace

## Mobile

* no overflow
* no clipped content
* touch targets are usable
* navigation works
* typography remains strong

---

# 44. FUNCTIONAL QA

After redesigning, verify:

* navigation
* links
* buttons
* forms
* authentication
* API calls
* database interactions
* filters
* search
* pagination
* sorting
* modals
* dropdowns
* mobile navigation
* notifications
* loading states
* error states
* empty states

Everything that worked before must continue working.

---

# 45. VALIDATION

Run the available project checks:

```text
lint
typecheck
tests
build
```

Do not claim success if a check was not actually executed.

If an existing failure is unrelated to your work, document it clearly.

---

# 46. FINAL DESIGN CHECKLIST

Before finishing:

### Global

* [ ] Read `design.md`
* [ ] Read relevant `.opencode` UI/UX Pro Max skills
* [ ] Established consistent design system
* [ ] Typography is consistent
* [ ] Spacing is consistent
* [ ] Colors are restrained
* [ ] Icons are modern and consistent

### Header

* [ ] Compact
* [ ] Clean
* [ ] Small typography
* [ ] Minimal icons
* [ ] No oversized CTA
* [ ] Responsive

### Main Dashboard

* [ ] No unnecessary borders
* [ ] No excessive boxes
* [ ] No card-grid appearance
* [ ] Bold page title
* [ ] Simple supporting text
* [ ] Strong metric hierarchy
* [ ] Clean modern icons
* [ ] Spacious layout
* [ ] Minimal shadows
* [ ] Minimal rounded corners
* [ ] Clean activity/list presentation

### Main Content

* [ ] Strong visual hierarchy
* [ ] Editorial layouts
* [ ] Large typography where appropriate
* [ ] Generous whitespace
* [ ] Minimal UI
* [ ] Existing content preserved

### Mobile

* [ ] Responsive
* [ ] No horizontal overflow
* [ ] Clean navigation
* [ ] Strong typography
* [ ] Proper spacing
* [ ] Touch-friendly controls

### Accessibility

* [ ] Keyboard accessible
* [ ] Focus states
* [ ] Proper contrast
* [ ] Semantic HTML
* [ ] Alt text
* [ ] Reduced motion

### Functionality

* [ ] Business logic unchanged
* [ ] APIs unchanged
* [ ] Data behavior unchanged
* [ ] Routes unchanged
* [ ] Existing functionality preserved
* [ ] Forms preserved
* [ ] Authentication preserved

---

# 47. FINAL IMPLEMENTATION PRINCIPLE

Do not think:

> "How can I add more UI to make this look modern?"

Think:

> "How can I make the existing product look more intentional with less visual noise?"

Use:

```text
Better typography
+
Better spacing
+
Better hierarchy
+
Better alignment
+
Better imagery
+
Better icons
+
Better responsive behavior
+
Subtle interaction
```

instead of:

```text
More cards
+
More borders
+
More gradients
+
More shadows
+
More colors
+
More decorations
```

---

# 48. FINAL DESIGN TARGET

The finished application should feel like a product designed by a professional design team.

It should feel:

**Clean**

**Modern**

**Premium**

**Minimal**

**Editorial**

**Confident**

**Polished**

**Responsive**

**Accessible**

**Intentional**

The central visual formula is:

```text
Compact Navigation
+
Strong Typography
+
Bold Titles
+
Simple Supporting Text
+
Generous Whitespace
+
Clean Modern Icons
+
Minimal Borders
+
Minimal Cards
+
Restrained Color
+
Strong Visual Hierarchy
+
Quiet Motion
=
Premium Modern UI
```

---

# 49. MOST IMPORTANT CONSTRAINT

You are changing the **presentation layer**, not the product itself.

Think of the task as:

```text
EXISTING APPLICATION
        ↓
KEEP EVERYTHING THAT MAKES IT WORK
        ↓
REDESIGN THE VISUAL EXPERIENCE
        ↓
APPLY design.md
        ↓
APPLY UI/UX PRO MAX
        ↓
POLISH EVERY COMPONENT
        ↓
VALIDATE EVERYTHING
        ↓
PRODUCTION-READY UI
```

The user should feel that they are using the **same application**, but that it has been completely transformed by a professional UI/UX team.

---

# FINAL COMMAND TO THE AI AGENT

**Inspect first.**

**Read `design.md`.**

**Read the relevant UI/UX Pro Max skills inside `.opencode`.**

**Understand the existing application.**

**Do not modify business logic.**

**Do not modify content.**

**Do not modify data behavior.**

**Do not modify routes.**

**Do not remove functionality.**

Then perform a complete visual redesign.

Pay special attention to the **main dashboard**.

The main dashboard must NOT look like a conventional card-heavy SaaS dashboard.

Avoid unnecessary:

```text
borders
boxes
rounded cards
shadows
colored containers
```

Instead, create structure through:

```text
bold headings
simple supporting text
large numbers
whitespace
alignment
clean rows
subtle separators
modern icons
```

Use **bold/semibold typography for headings and titles**.

Use **simple regular typography for supporting content**.

Use **clean, modern, consistent icons**.

Make the entire interface feel **clean, calm, premium, editorial, and professionally designed**.

Follow the design philosophy in `design.md`: large typography, compact navigation, expansive whitespace, restrained color, minimal UI, strong visual composition, and intentional visual hierarchy.

Do not stop after making the first page look good.

Apply the design system consistently throughout the entire existing application.

**The final result must be a polished production-quality redesign without changing what the application actually does.**
