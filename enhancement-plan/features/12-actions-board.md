# Feature 12 — Actions Board (Kanban)

> **Status: DONE** — Added search, urgency filter chips, an "Urgent focus" toggle, and a progress summary (X of Y done + completion bar with `role="progressbar"`). Moves (drag/arrow) announce via a visually-hidden `aria-live` region.

## 1. What it is & its role

The **Actions Board** is a private Kanban board that collects every action from a user's analyses and lets them track progress across three columns: **To Do → In Progress → Done**. Its role is to turn extracted actions into a manageable, persistent task-tracking workflow.

## 2. Current functionality

### Where it lives
- **State:** `src/context/TaskContext.tsx` → `board: BoardItem[]`, `setItemStatus`, `reorderItem`, `saveAnalysis` (auto-adds actions).
- **Persistence:** `localStorage` key `taskmind:board`.
- **UI:** `src/components/board/ActionsBoard.tsx` + route `src/app/actions/page.tsx`.
- **Types:** `src/lib/types.ts` → `BoardItem`, `BoardStatus`.

### How it works today
1. On each analysis, `saveAnalysis` creates a `BoardItem` per action with `status: "todo"`, `urgency`, and source pointers (`sourceId`, `sourceIndex`).
2. `ActionsBoard` renders three columns with counts.
3. Users can **drag** cards between columns, use arrow buttons to move left/right, and click a card to open its source analysis.
4. Empty columns show an "Empty" placeholder.

### Current limitations
- **localStorage only** — no cross-device sync.
- **No reordering within a column** (only cross-column moves); `reorderItem` only changes status, despite the name.
- **No editing** of action text or adding manual tasks.
- **No due dates / reminders** on board items.
- No filtering, sorting, or search on the board.
- No "done" stats / progress summary.
- Dragging has no touch/mobile support (mobile users rely on arrow buttons).
- No persistence of board item order.

## 3. Future enhancements (production-ready Actions Board)

### 3.1 Backend persistence & sync
- Persist board items to a database tied to the user account (Feature 19) and sync across devices.

### 3.2 Full Kanban support
- Implement true **in-column reordering** (drag to reorder) and persist order.
- Add **touch/drag** support for mobile.
- Add **edit/rename** action text and **add manual tasks**.

### 3.3 Task metadata
- Add optional **due dates** (link to Feature 02), **reminders**, **labels/tags**, and **notes** per item.
- Derive due dates from the linked deadline when available.

### 3.4 Productivity features
- **Filter/sort** by urgency, due date, or source.
- **Search** the board.
- Show column **progress** (e.g., "3 of 10 done") and a completion summary.
- Add a "focus" view showing only today's urgent items.

### 3.5 Accessibility
- Ensure drag-and-drop is keyboard-accessible (arrow buttons already exist; add `aria` live announcements for moves).

### 3.6 Testing
- Unit tests for status transitions and ordering.
- E2E tests for drag, move, edit, and sync.

> **Definition of "done" for this feature:** Board persists to backend, supports full drag-reorder (desktop + mobile), task editing, due dates/reminders, filtering/sorting/search, progress stats, and is fully tested.
