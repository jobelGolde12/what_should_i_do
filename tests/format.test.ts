import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDateTime, formatRelative, snippet } from "@/lib/format";

const NOW = new Date("2026-08-10T09:00:00");

describe("format", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDateTime", () => {
    it("formats a timestamp as month day, year · time", () => {
      expect(formatDateTime(NOW.getTime())).toBe("Aug 10, 2026 · 09:00");
    });
  });

  describe("formatRelative", () => {
    it("returns just now for the current time", () => {
      expect(formatRelative(NOW.getTime())).toBe("just now");
    });

    it("returns minutes ago", () => {
      expect(formatRelative(NOW.getTime() - 5 * 60_000)).toBe("5m ago");
    });

    it("returns hours ago", () => {
      expect(formatRelative(NOW.getTime() - 3 * 3_600_000)).toBe("3h ago");
    });

    it("returns days ago within the first week", () => {
      expect(formatRelative(NOW.getTime() - 2 * 86_400_000)).toBe("2d ago");
    });

    it("falls back to formatDateTime beyond a week", () => {
      expect(formatRelative(NOW.getTime() - 30 * 86_400_000)).toBe(
        "Jul 11, 2026 · 09:00"
      );
    });
  });

  describe("snippet", () => {
    it("collapses whitespace and trims edges", () => {
      expect(snippet("  hello   world  ")).toBe("hello world");
    });

    it("returns short text unchanged", () => {
      expect(snippet("short text")).toBe("short text");
    });

    it("truncates long text with an ellipsis", () => {
      const out = snippet("a".repeat(150), 140);
      expect(out.length).toBe(141);
      expect(out.endsWith("…")).toBe(true);
      expect(out.slice(0, 140)).toBe("a".repeat(140));
    });
  });
});
