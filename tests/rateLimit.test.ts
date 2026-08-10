import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T09:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getClientIp", () => {
    it("takes the first x-forwarded-for value", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("falls back to x-real-ip", () => {
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("returns unknown when no client header is present", () => {
      expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
    });
  });

  describe("rateLimit", () => {
    it("allows requests up to the limit and blocks the rest", () => {
      const r1 = rateLimit("ip-a", 2);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);

      const r2 = rateLimit("ip-a", 2);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0);

      const r3 = rateLimit("ip-a", 2);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it("resets the window after it elapses", () => {
      rateLimit("ip-b", 1);
      expect(rateLimit("ip-b", 1).allowed).toBe(false);

      vi.advanceTimersByTime(61_000);

      const r = rateLimit("ip-b", 1);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(0);
    });

    it("tracks windows independently per ip", () => {
      rateLimit("ip-c", 1);
      expect(rateLimit("ip-c", 1).allowed).toBe(false);
      expect(rateLimit("ip-d", 1).allowed).toBe(true);
    });
  });
});
