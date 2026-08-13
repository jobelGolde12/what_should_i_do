# Pro Plan — 05 · Calendar, Reminders & Weekly Digest

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Deadlines are extracted and exportable today; Pro makes them **act on you**: one
click to add all deadlines to a calendar, email/SMS reminders before a deadline,
and a weekly digest of what's coming up. This is the retention feature — it
brings users back.

## Where it fits today

- `src/lib/deadline.ts` parses deadlines; `src/lib/ics.ts` builds `.ics` files
  and `downloadIcs`; the results panel offers Google/Outlook deep links. No
  reminders, no scheduling, no digests.
- Email delivery exists via `src/lib/mailgun.ts` (verification/reset emails).

## Depends on

- `00-entitlements-and-gating.md` (Pro-only reminders/digest)
- `04-cloud-sync-multi-device.md` (so reminder scheduling can read server-side
  deadlines for a logged-in user)

---

## Tasks

### 1. One-click calendar add (enhance existing)

- [x] In the deadlines section of `ResultsPanel`, add "Add to Google" /
  "Add to Outlook" (already have deep links — verify correctness) and a new
  **"Add all to calendar"** `.ics` download that includes title, start/end from
  the parsed deadline + a computed duration, and a description with the actions.
- [x] For Pro, persist a "calendar plan" per deadline (already added / reminder
  set) so re-open of an analysis doesn't double-add.

### 2. Reminders engine

- [x] Add `reminders` table (`id`, `user_id`, `analysis_id`, `deadline_text`,
  `due_at`, `remind_at`, `sent`, `channel`) to `src/lib/db/schema.ts` (bump
  version, migrate).
- [x] When a Pro analysis completes with deadlines, offer "Remind me" with
  presets (30 min before, 1 h before, 1 day before, custom) and create reminder
  rows.
- [x] Add `src/app/api/cron/reminders/route.ts` (protected by `CRON_SECRET` or
  Vercel Cron): query `remind_at <= now AND sent = 0`, send via
  `src/lib/mailgun.ts` (and optionally an SMS provider later), mark sent.
- [x] Add a manual "Send now" test hook behind `?dry=1` for verification.

### 3. Weekly digest

- [x] Add a weekly aggregation query (upcoming deadlines in the next 7 days,
  overdue items, top actions) and a digest email template (Mailgun) summarizing
  the week.
- [x] Add `src/app/api/cron/digest/route.ts` (weekly schedule) sending to Pro
  users with reminders/digest enabled.
- [x] Rate-limit and dedupe digest sends per user/week.

### 4. Preferences UI

- [x] In `SettingsView.tsx`, add a "Reminders & digest" section: enable/disable,
  reminder default presets, digest day/time, timezone (from the client).
- [x] Store prefs in `user_settings` (schema already exists).

### 5. Tests

- [x] Unit: `tests/reminders.test.ts` — reminder row creation, due/remind time
  math, cron query window, dedupe.
- [x] Unit: `tests/digest.test.ts` — aggregation + email payload building.
- [x] Route tests: cron auth (`CRON_SECRET`), 401 without it, dry-run flag.

## Definition of done

- [x] Pro users add deadlines to their calendar in one click and receive a
  reminder email before a deadline.
- [x] Weekly digest emails land once per week with correct data and no dupes.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
