# TODO

## Done
- [x] Empty the input field (and clear the attached-file chip) when the user sends a message in `CleanComposer.tsx`
- [x] Analysis result polish (`ResultsPanel` + children): remove borders/boxes, modern dark & white only
  - [x] Header: no divider border, no "AI analysis / Rule-based" badge, no "Resolved" badge
  - [x] Share / Delete / Cancel → icon-only buttons with tooltip above on hover
  - [x] Section reveal line + heading dash → ink instead of red accent
  - [x] Actions: round black checkboxes, category label → icon with tooltip, neutral urgency dot with tooltip
  - [x] Deadlines: borderless rows, Google/Outlook → icon-only links with tooltips, status labels → icons with tooltips
  - [x] Unclear parts: no colored boxes, copy button → icon-only with tooltip, mono severity
  - [x] Next step: typographic block, no accent card
  - [x] Urgency: monochrome meter bars
  - [x] Translate / Reply / Chat panels: unboxed, monochrome pills, dark buttons, soft-surface inputs
  - [x] Summary highlights monochrome; original-input block unboxed in `AnalysisView`
- [x] Remove "Analyses powered by AI, with rule-based fallback" from `SiteFooter` and settings footer

## Up next
- [ ] Add a shared `Tooltip` usage pass over remaining icon-only controls app-wide (nav, history cards)
- [ ] Keyboard focus trap + Esc handling for the new collapsible panels (Translate, Reply, Chat)
- [ ] Respect `prefers-reduced-motion` for tooltip transition (currently inherits global reduce rule — verify)
- [ ] Mobile: verify tooltips don't overflow viewport near right edge; flip alignment if needed
- [ ] Dark mode QA sweep of the results panel after de-accenting (surface-2 contrast on marks/pills)
