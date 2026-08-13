# Pro Plan — 08 · Custom Workflows & Templates

**Status:** `[ ]` Not started · `[ ]` In progress · `[ ]` Done

## What it is & why it's Pro

Templates today are static (name + content that pre-fill the input). Pro users
get **dynamic templates** (variables, auto-fill), **tags** on history/actions,
and **automation rules** that apply based on message content. This makes TaskMind
a repeatable system for high-volume users (teachers, offices, community groups).

## Where it fits today

- Templates: `Template` type (`src/lib/types.ts`), `storePendingTemplate` +
  `consumePendingTemplate` (`src/lib/applyTemplate.ts`), saved page + QuickSearch.
- No variables, no tags, no rules.

## Depends on

- `00-entitlements-and-gating.md` (Pro-only)
- `04-cloud-sync-multi-device.md` (template/tag persistence across devices)

---

## Tasks

### 1. Template variables & auto-fill

- [ ] Define a variable set (`{{date}}`, `{{time}}`, `{{sender}}`, `{{name}}`,
  `{{org}}`, `{{today}}`) and a renderer in `src/lib/applyTemplate.ts` that
  fills them from the current message/sender when the template is applied.
- [ ] Ask for any unresolved variables (small inline prompt) before running the
  analysis; resolved values are shown in the final input.
- [ ] Add template **categories** and a searchable template picker in the
  Saved page (`src/components/saved/`) and QuickSearch.

### 2. Tags & organization

- [ ] Add `tags` to `AnalysisRecord`/`BoardItem` (schema + localStorage shapes;
  bump types carefully) and a tag editor on results and history items.
- [ ] Filter history/board by tag (extend `HistoryView` filter + QuickSearch) and
  persist via settings/sync.

### 3. Automation rules

- [ ] Add a rules engine `src/lib/rules.ts` + a rules editor in Settings:
  `if <message contains|from|urgency predicted> then <apply template | tag |
  set priority | draft reply>`.
- [ ] Evaluate rules after analysis completes (server action side) and apply
  actions (auto-tag, auto-apply template, pre-seed a reply draft in plan `01`).
- [ ] Show "rules applied" feedback in the results panel (chip list) so
  automation is transparent.

### 4. Tests

- [ ] Unit: `tests/templates.test.ts` — variable rendering, unresolved-variable
  prompt, category search.
- [ ] Unit: `tests/rules.test.ts` — condition matching + side-effect mapping,
  ordering, no infinite loops.

## Definition of done

- [ ] Pro users apply dynamic templates that auto-fill from the message and run
  automation rules that tag/seed drafts based on content.
- [ ] Tags filter history and the actions board.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
