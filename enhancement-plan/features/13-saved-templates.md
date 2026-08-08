# Feature 13 — Saved Templates

## 1. What it is & its role

The **Saved Templates** feature lets users save recurring inputs (weekly reports, meeting notes, form letters) and re-apply them quickly to the analysis input. Its role is to reduce friction for power users who analyze similar text repeatedly.

## 2. Current functionality

### Where it lives
- **State:** `src/context/TaskContext.tsx` → `templates: Template[]`, `saveTemplate`, `deleteTemplate`.
- **Persistence:** `localStorage` key `taskmind:templates`.
- **UI:** `src/components/saved/SavedView.tsx` + route `src/app/saved/page.tsx`.
- **Quick-save:** `InputArea.tsx` "Save template" button (saves current input with an auto-generated name).
- **Apply:** dispatches a `taskmind:apply-template` custom event consumed by `InputArea`.

### How it works today
1. User saves a template from the input area, or creates one in the Saved view (with optional name and content).
2. Templates list shows name, relative creation time, and a snippet.
3. "Apply" navigates to `/` and dispatches an event that fills the textarea (via `QuickSearch` or `SavedView`).
4. Templates persist in `localStorage`.

### Current limitations
- **localStorage only** — no cross-device sync.
- **No editing** an existing template (only create/delete).
- **No organization** (folders/tags) and no duplicate detection.
- No import/export.
- Applying requires a round-trip navigation + event dispatch (fragile timing with `setTimeout`).
- Auto-generated names are just the first 40 chars of content.
- No template categories or preview thumbnails.

## 3. Future enhancements (production-ready Saved Templates)

### 3.1 Backend persistence & sync
- Store templates in a database against the user account (Feature 19) and sync across devices.

### 3.2 Full CRUD
- Add **edit/rename** and **duplicate** actions.
- Add **tags/folders** and drag-to-organize.

### 3.3 Better apply flow
- Apply templates **in-place** without navigation (avoid the event/setTimeout indirection) by lifting template content into shared state or a loadable action.
- Add keyboard affording and accessibility labels.

### 3.4 Import/export
- Export templates to JSON; import from JSON.

### 3.5 Smart naming
- Suggest a meaningful name from the content via keyword extraction.

### 3.6 Testing
- Unit tests for save/delete/edit/duplicate logic.
- E2E tests for create, apply, and delete flows.

> **Status: DONE** — Implemented in this round: full CRUD (edit/rename via `updateTemplate`, duplicate via `duplicateTemplate` in `TaskContext`); reliable apply flow via `sessionStorage`-backed `storePendingTemplate`/`consumePendingTemplate` (`src/lib/applyTemplate.ts`) consumed on dashboard mount — removes the router + `setTimeout` + custom-event race in both `SavedView` and `QuickSearch`; JSON import/export and duplicate detection deferred to a later round (localStorage-only persistence, no cross-device sync yet).

> **Definition of "done" for this feature:** Templates persist to backend, support full CRUD + organization, apply in-place reliably, import/export, and are fully tested.
