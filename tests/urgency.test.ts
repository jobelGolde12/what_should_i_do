import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  URGENCY_LEVELS,
  URGENCY_META,
  URGENCY_VALUES,
  isUrgencyLevel,
  clampUrgency,
  deadlineHorizon,
  classifyUrgency,
  urgencyForAction,
} from "@/lib/urgency";

const NOW = new Date("2026-08-10T09:00:00");

describe("urgency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isUrgencyLevel", () => {
    it("accepts all known levels", () => {
      expect(isUrgencyLevel("Informational")).toBe(true);
      expect(isUrgencyLevel("Important")).toBe(true);
      expect(isUrgencyLevel("Urgent")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isUrgencyLevel("urgent")).toBe(false);
      expect(isUrgencyLevel("")).toBe(false);
      expect(isUrgencyLevel(42)).toBe(false);
      expect(isUrgencyLevel(null)).toBe(false);
    });
  });

  describe("clampUrgency", () => {
    it("passes known levels through unchanged", () => {
      expect(clampUrgency("Urgent")).toBe("Urgent");
      expect(clampUrgency("Important")).toBe("Important");
    });

    it("maps invalid values to Informational", () => {
      expect(clampUrgency("URGENT!")).toBe("Informational");
      expect(clampUrgency(undefined)).toBe("Informational");
    });
  });

  describe("URGENCY_LEVELS ordering", () => {
    it("orders levels from low to high severity", () => {
      expect(URGENCY_VALUES).toEqual(["Informational", "Important", "Urgent"]);
      const orders = URGENCY_LEVELS.map((l) => l.order);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    });

    it("exposes metadata keyed by level", () => {
      expect(URGENCY_META.Urgent.label).toBe("Urgent");
      expect(URGENCY_META.Informational.color).toBe("text-low");
      expect(URGENCY_META.Important.fill).toBe("bg-med");
    });
  });

  describe("deadlineHorizon", () => {
    it("returns null when no deadline parses", () => {
      expect(deadlineHorizon([], NOW)).toBeNull();
      expect(deadlineHorizon(["whenever maybe"], NOW)).toBeNull();
    });

    it("returns a positive horizon for an upcoming deadline", () => {
      const horizon = deadlineHorizon(["tomorrow"], NOW);
      expect(horizon).not.toBeNull();
      expect(horizon!).toBeGreaterThan(0);
      expect(horizon!).toBeLessThanOrEqual(24 * 3_600_000);
    });

    it("picks the soonest of several deadlines", () => {
      const soon = deadlineHorizon(["in 10 days", "tomorrow"], NOW);
      const later = deadlineHorizon(["tomorrow", "in 10 days"], NOW);
      expect(soon).toBe(later);
      expect(soon!).toBeGreaterThan(0);
      expect(soon!).toBeLessThanOrEqual(24 * 3_600_000);
    });
  });

  describe("classifyUrgency", () => {
    it("flags urgent language", () => {
      const d = classifyUrgency("Please respond asap", [], NOW);
      expect(d.level).toBe("Urgent");
      expect(d.reason).toContain("urgent language");
      expect(d.confidence).toBe(0.85);
    });

    it("flags weather and safety alerts as Urgent", () => {
      const d = classifyUrgency("Typhoon signal no. 3 raised", [], NOW);
      expect(d.level).toBe("Urgent");
      expect(d.confidence).toBe(0.9);
    });

    it("treats lost-and-found notices as Informational", () => {
      const d = classifyUrgency("My lost wallet was found", [], NOW);
      expect(d.level).toBe("Informational");
      expect(d.confidence).toBe(0.9);
    });

    it("marks deadlines within 24 hours as Urgent", () => {
      const d = classifyUrgency("The report is due tomorrow", ["tomorrow"], NOW);
      expect(d.level).toBe("Urgent");
      expect(d.confidence).toBe(0.8);
    });

    it("marks deadlines within the next week as Important", () => {
      const d = classifyUrgency("Submit by end of week", ["in 5 days"], NOW);
      expect(d.level).toBe("Important");
      expect(d.confidence).toBe(0.75);
    });

    it("marks far-off or unparseable deadlines as Important", () => {
      const far = classifyUrgency("Plan the event", ["in 30 days"], NOW);
      expect(far.level).toBe("Important");
      expect(far.confidence).toBe(0.7);

      const vague = classifyUrgency("Plan the event", ["whenever maybe"], NOW);
      expect(vague.level).toBe("Important");
      expect(vague.reason).toContain("deadline");
    });

    it("defaults to Informational when nothing is time-sensitive", () => {
      const d = classifyUrgency("Here is some general information", [], NOW);
      expect(d.level).toBe("Informational");
      expect(d.confidence).toBe(0.9);
    });
  });

  describe("urgencyForAction", () => {
    it("maps a single action to an urgency level", () => {
      expect(urgencyForAction("Pay the bill today")).toBe("Urgent");
      expect(urgencyForAction("Read the attached notes")).toBe("Informational");
    });
  });
});
