# Task Completion Plan: Update Header/Footer Text to "TaskMind" & Fix Logo

**Status:** In progress  
**Owner:** Frontend / UI polish  
**Related files:**
- `src/components/header/page.tsx`
- `src/components/Footer.tsx`
- `src/app/layout.tsx` (metadata — already updated)
- `public/file.svg` / `public/favicon.ico`

---

## Goal

Replace all legacy branding ("What Should I Do" / ActionClarity) with the new **TaskMind** brand in the site header and footer, and ensure the logo renders correctly (proper `alt` text, dimensions, and layout).

---

## Detailed Steps

### 1. Analyze the current files and branding references
- [x] Read `src/components/header/page.tsx` — confirmed header already renders:
  - Logo via `next/image` from `/favicon.ico` with `alt="TaskMind"` (32×32).
  - Brand text `<span className="text-xl font-bold text-gray-800">TaskMind</span>`.
  - Nav links: "How it works" (`#how-it-works`), "Features" (`#features`), and CTA "Try Now" (`#main-input-area`).
- [x] Read `src/components/Footer.tsx` — confirmed footer already renders:
  - Logo via `next/image` from `/favicon.ico` with `alt="TaskMind"` (32×32).
  - Brand text `<span className="text-xl font-bold">TaskMind</span>`.
  - Tagline "Clear actions from confusing messages." and subtitle "A Universal Instruction Translator".
- [x] Read `src/app/layout.tsx` — `metadata.title` is already `"TaskMind"`.
- [x] Read `src/app/page.tsx` — structured data (WebApplication/ItemList) uses `name: 'TaskMind'` and `author.name: 'TaskMind'`.
- [x] Grep the repo for stale references: `What Should I Do`, `ActionClarity`, `whatshouldido`, etc. (see Step 5 checklist).

### 2. Update `src/components/header/page.tsx` (text & logo)
- [x] Ensure the logo `<Image>` uses `/favicon.ico` with explicit `width={32}` `height={32}`.
- [x] Add descriptive `alt` text (e.g., `alt="TaskMind"`).
- [x] Ensure brand text is `TaskMind` (done).
- **Suggested hardening (optional follow-up):**
  - Wrap the logo + brand in a single `<a href="/">` for a clickable home link.
  - Add `priority` or remove empty `className=""` on the `<Image>`.
  - Normalize JSX indentation (the file currently has mixed indentation).

### 3. Update `src/components/Footer.tsx` (text & logo)
- [x] Logo `<Image>` points to `/favicon.ico`, `alt="TaskMind"`, 32×32 (done).
- [x] Brand text is `TaskMind` (done).
- **Suggested hardening (optional follow-up):**
  - The social-icon block is currently commented out — decide whether to restore with real links (GitHub, X/Twitter, LinkedIn).
  - Add a copyright line and link to the repository.
  - Normalize indentation and remove empty `className=""`.

### 4. Create tracking documentation
- [x] `TODO.md` at repo root tracks the 5-step completion plan.
- [x] This detailed plan file documents file paths, current state, and acceptance criteria.

### 5. Verify changes and complete task
- [ ] Run a full-repo search for stale branding strings and fix leftovers:
  ```bash
  grep -ri "what should i do" --include="*.tsx" --include="*.ts" --include="*.md" .
  grep -ri "actionclarity" -i --include="*.tsx" --include="*.ts" --include="*.md" .
  grep -ri "whatshouldido.app" --include="*.tsx" --include="*.ts" .
  ```
- [ ] Confirm `npm run dev` loads without errors.
- [ ] Confirm `npm run build` passes (catches type/JSX issues).
- [ ] Manually verify in the browser:
  - Header shows **TaskMind** logo + text, sticky at top, correct on mobile (hamburger/nav collapse behavior).
  - Footer shows **TaskMind** logo + text, tagline, and responsive layout.
  - Logo image renders (no broken image icon) in both header and footer.
- [ ] If any leftover branding exists (README, `sitemap.ts` URL `whatshouldido-five.vercel.app`, OpenGraph URL in `page.tsx`), log it as a separate follow-up plan so branding is fully consistent.

---

## Acceptance Criteria

1. Header displays the TaskMind brand (logo + text) correctly on all viewports.
2. Footer displays the TaskMind brand (logo + text) correctly on all viewports.
3. No broken image references (`/favicon.ico` exists and loads).
4. No compile/lint errors introduced.
5. Stale branding outside the header/footer is documented as follow-ups (README + canonical/OpenGraph URLs still reference `whatshouldido`).

---

## Related Notes

- The app is deployed on Vercel: https://whatshouldido-five.vercel.app
- Canonical/OpenGraph URLs in `src/app/page.tsx` still point to `https://whatshouldido.app/` — a follow-up plan should align these with the final TaskMind domain once chosen.

