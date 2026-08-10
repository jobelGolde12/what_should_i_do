import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseDeadline,
  formatDeadline,
  sortDeadlines,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "@/lib/deadline";

const NOW = new Date("2026-08-10T09:00:00");

describe("deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("parseDeadline", () => {
    it("returns a null date for empty or null input", () => {
      expect(parseDeadline(null).date).toBeNull();
      expect(parseDeadline(undefined).date).toBeNull();
      expect(parseDeadline("").date).toBeNull();
    });

    it("parses natural-language deadlines via chrono", () => {
      const r = parseDeadline("tomorrow");
      expect(r.date).not.toBeNull();
      expect(r.date!.getDate()).toBe(11); // Aug 11
      expect(r.overdue).toBe(false);
      expect(r.label).not.toBeNull();
    });

    it("parses explicit ISO dates", () => {
      const r = parseDeadline("2026-12-25");
      expect(r.date).not.toBeNull();
      expect(r.date!.getFullYear()).toBe(2026);
      expect(r.date!.getMonth()).toBe(11);
      expect(r.date!.getDate()).toBe(25);
    });

    it("falls back for EOD expressions", () => {
      const r = parseDeadline("end of day");
      expect(r.date).not.toBeNull();
      expect(r.date!.getDate()).toBe(10);
      expect(r.date!.getHours()).toBe(17);
    });

    it("parses end-of-day variants to today at 5pm, not the next morning", () => {
      for (const input of [
        "end of the day",
        "end of today",
        "eod",
        "close of business",
      ]) {
        const r = parseDeadline(input);
        expect(r.date, input).not.toBeNull();
        expect(r.date!.getDate(), input).toBe(10);
        expect(r.date!.getHours(), input).toBe(17);
      }
    });

    it("parses end-of-month variants to the last day of the month at 5pm", () => {
      for (const input of ["end of the month", "end of this month", "end of month"]) {
        const r = parseDeadline(input);
        expect(r.date, input).not.toBeNull();
        expect(r.date!.getMonth(), input).toBe(7); // August
        expect(r.date!.getDate(), input).toBe(31);
        expect(r.date!.getHours(), input).toBe(17);
      }
    });

    it("parses relative day counts via the regex fallback", () => {
      const inDays = parseDeadline("in 3 days");
      expect(inDays.date).not.toBeNull();
      expect(inDays.date!.getDate()).toBe(13);
      expect(inDays.date!.getHours()).toBe(9);
    });

    it("applies 24-hour clock times", () => {
      const r = parseDeadline("tomorrow at 18:00");
      expect(r.date).not.toBeNull();
      expect(r.date!.getHours()).toBe(18);
      expect(r.date!.getMinutes()).toBe(0);
    });

    it("falls back for Filipino relative expressions", () => {
      const inDays = parseDeadline("sa loob ng 3 araw");
      expect(inDays.date).not.toBeNull();
      expect(inDays.date!.getDate()).toBe(13);
      expect(inDays.date!.getHours()).toBe(9);

      const nextWeek = parseDeadline("sa isang linggo");
      expect(nextWeek.date!.getDate()).toBe(17);
    });

    it("applies an explicit time to the parsed date", () => {
      const r = parseDeadline("tomorrow at 5:30pm");
      expect(r.date).not.toBeNull();
      expect(r.date!.getHours()).toBe(17);
      expect(r.date!.getMinutes()).toBe(30);
    });

    it("marks past dates as overdue", () => {
      const r = parseDeadline("2020-01-01");
      expect(r.date).not.toBeNull();
      expect(r.overdue).toBe(true);
    });

    it("returns a null date for unparseable input", () => {
      const r = parseDeadline("whenever maybe");
      expect(r.date).toBeNull();
      expect(r.overdue).toBe(false);
    });
  });

  describe("formatDeadline", () => {
    it("renders a human-readable label", () => {
      const label = formatDeadline(new Date("2026-08-11T09:00:00"));
      expect(label).not.toBe("");
      expect(label).toMatch(/\d/);
    });
  });

  describe("sortDeadlines", () => {
    it("orders parseable deadlines soonest first and unparseable ones last", () => {
      const sorted = sortDeadlines(["in 10 days", "tomorrow", "whenever maybe"]);
      expect(sorted).toEqual(["tomorrow", "in 10 days", "whenever maybe"]);
    });
  });

  describe("googleCalendarUrl", () => {
    it("builds a deep link with the event details", () => {
      const url = new URL(googleCalendarUrl("Submit report", new Date("2026-08-11T09:00:00")));
      expect(url.host).toBe("calendar.google.com");
      expect(url.searchParams.get("action")).toBe("TEMPLATE");
      expect(url.searchParams.get("text")).toBe("Submit report");
      expect(url.searchParams.get("details")).toBe("Deadline from TaskMind");
      expect(url.searchParams.get("dates")).toMatch(/^\d{8}T\d{6}\/\d{8}T\d{6}$/);
      expect(url.searchParams.has("ctz")).toBe(true);
    });
  });

  describe("outlookCalendarUrl", () => {
    it("builds a deep link with ISO start and end times", () => {
      const start = new Date("2026-08-11T09:00:00");
      const url = new URL(outlookCalendarUrl("Submit report", start));
      expect(url.host).toBe("outlook.live.com");
      expect(url.searchParams.get("subject")).toBe("Submit report");
      expect(url.searchParams.get("startdt")).toBe(start.toISOString());
      expect(url.searchParams.get("enddt")).toBe(
        new Date(start.getTime() + 3_600_000).toISOString()
      );
      expect(url.searchParams.get("body")).toBe("Deadline from TaskMind");
    });
  });
});
