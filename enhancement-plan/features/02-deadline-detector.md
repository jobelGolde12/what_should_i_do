# Feature 02 — Deadline Detector

> **Status: DONE** — Replaced fragile rule parsing with `chrono-node` (dozens of natural-language + relative formats, plus Tagalog "bukas"/"mamaya"/"sa loob ng N araw" fallbacks) via shared `src/lib/deadline.ts`; added per-deadline Google Calendar / Outlook deep links, chronological sorting, and "overdue" state to `DeadlineList`; fixed `cleanText` bug that stripped weekday/time/date tokens before rule extraction; expanded `DEADLINE_REGEX` and deduped deadline lists (AI + rule paths). `.ics` export now reuses the same parser.

## 1. What it is & its role

The **Deadline Detector** identifies time references in text ("by EOD", "next Friday", "end of month", "tomorrow at 10 AM", "effective immediately") and turns them into concrete, meaningful dates/times. It also provides a one-click **calendar export (.ics)** so deadlines become real calendar events.

Its role is to answer: **"When is this due?"** — translating vague references into actionable schedules.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → system prompt returns a `deadlines` string array.
- **Rule fallback:** `src/lib/analyzeRules.ts` → `DEADLINE_REGEX` matches `today`, `tomorrow`, `until lifted`, `effective hh:mm`, `November NN, YYYY`.
- **Rendering:** `src/components/results/DeadlineList.tsx`.
- **Calendar export:** `src/lib/ics.ts` → `buildIcs()` + `downloadIcs()`.

### How it works today
1. The model (or rules) returns a `deadlines: string[]`.
2. `DeadlineList.tsx` filters out the placeholder `"No deadline mentioned"` and renders each deadline with a calendar icon.
3. A button "Export deadlines (.ics)" calls `downloadIcs()`, which:
   - Parses each deadline string via `findFirstDate()` (supports ISO dates, US `m/d/yyyy`, month names, weekday names, "today", "tomorrow", "end of month").
   - Applies a parsed time via `applyTime()` (e.g., "10 AM").
   - Builds a valid `VCALENDAR`/`VEVENT` document and triggers a browser download.

### Current limitations
- **Parsing is rule-based and fragile** — many formats return `null` from `findFirstDate()` and produce no event.
- Only **one date/time** is extracted per deadline string even if multiple exist.
- No relationship between a deadline and its corresponding action.
- No timezone handling (uses local time implicitly).
- No "add to Google Calendar / Outlook" direct links.
- Relative deadlines ("in 2 weeks", "next quarter") are not computed.
- No reminder/notification mechanism.

## 3. Future enhancements (production-ready Deadline Detector)

### 3.1 Robust NLP date parsing
- Use a dedicated date-parsing library (e.g., `chrono-node`) to handle dozens of natural-language formats in English and Filipino.
- Support relative expressions: "in 3 days", "2 weeks from now", "next quarter", "by end of day", "ASAP".

### 3.2 Structured deadlines model
```ts
type DeadlineItem = {
  id: string;
  raw: string;          // original text
  parsed: string | null; // ISO timestamp when parseable
  label: string;        // human-friendly date
  time?: string;
  timezone?: string;
  confidence?: number;
  linkedActionId?: string;
};
```

### 3.3 Calendar integration
- Add **Google Calendar** and **Outlook** "add to calendar" deep-link buttons.
- Send email reminders (via a notification service) when a deadline is within a configurable window.

### 3.4 Timezone-aware handling
- Capture the user's timezone (from browser or settings) and store deadlines in UTC, rendering in local time.

### 3.5 Deadline grouping & sorting
- Sort deadlines chronologically.
- Group by day/week/month in the UI.
- Show "overdue" state for past deadlines.

### 3.6 Persistence & sync
- Store parsed deadlines in the record so re-opening history shows the same parsed dates.
- Sync to the backend/calendar service when the user is signed in.

### 3.7 Testing
- Unit tests for `chrono-node` parsing across a broad corpus of deadline phrases.
- Golden-file tests for `.ics` output validity (can be imported by common calendar apps).

> **Definition of "done" for this feature:** All common deadline formats parse reliably, deadlines link to actions, exports work for Google/Outlook/ICS, timezones are correct, and parsing is fully covered by tests.
