import { describe, it, expect } from "vitest";
import { buildShareLink, parseShareToken, buildShareMarkdown } from "@/lib/share";

const RECORD = {
  input: "Submit the report by Friday",
  output: {
    summary: "Submit the report by Friday.",
    actions: ["Submit the report"],
    deadlines: ["Friday"],
    urgency: "Important" as const,
    confusingParts: [],
    nextStep: "Submit the report",
    analysisMethod: "ai" as const,
  },
  timestamp: 1_752_000_000_000,
};

describe("share", () => {
  describe("buildShareLink", () => {
    it("builds a prefixed share path (no origin in node)", () => {
      const link = buildShareLink(RECORD);
      expect(link.startsWith("/share/enc:")).toBe(true);
    });

    it("round-trips a link back through parseShareToken", () => {
      const link = buildShareLink(RECORD);
      const id = link.split("/share/")[1];
      const payload = parseShareToken(id);
      expect(payload).not.toBeNull();
      expect(payload?.output).toEqual(RECORD.output);
      expect(payload?.input).toBe(RECORD.input);
      expect(payload?.timestamp).toBe(RECORD.timestamp);
    });

    it("flags optional share options on the payload", () => {
      const payload = parseShareToken(
        buildShareLink(RECORD, { includeInput: false, sensitive: true }).split("/share/")[1]
      );
      expect(payload?.includeInput).toBe(false);
      expect(payload?.sensitive).toBe(true);
    });
  });

  describe("parseShareToken", () => {
    it("accepts a token without the enc: prefix", () => {
      const id = buildShareLink(RECORD).split("/share/enc:")[1];
      expect(parseShareToken(id)?.output).toEqual(RECORD.output);
    });

    it("returns null for invalid tokens", () => {
      expect(parseShareToken("not-base64!!!")).toBeNull();
      expect(parseShareToken("")).toBeNull();
    });

    it("returns null for tampered tokens", () => {
      const id = buildShareLink(RECORD).split("/share/enc:")[1];
      expect(parseShareToken(id.slice(0, -1))).toBeNull();
    });
  });

  describe("buildShareMarkdown", () => {
    it("renders urgency, summary, next step, and numbered actions", () => {
      const md = buildShareMarkdown(RECORD, "https://taskmind.app/share/enc:x");
      expect(md).toContain("# What should I do?");
      expect(md).toContain("**Urgency:** Important");
      expect(md).toContain("## Summary");
      expect(md).toContain(RECORD.output.summary);
      expect(md).toContain("## Next step");
      expect(md).toContain(RECORD.output.nextStep);
      expect(md).toContain("## Actions");
      expect(md).toContain("1. Submit the report");
      expect(md).toContain("_Shared via https://taskmind.app/share/enc:x_");
    });

    it("quotes raw input with blockquote markers", () => {
      const md = buildShareMarkdown(
        { ...RECORD, input: "line one\nline two" },
        "https://taskmind.app/share/enc:x"
      );
      expect(md).toContain("> line one");
      expect(md).toContain("> line two");
    });

    it("omits raw input when includeInput is false", () => {
      const md = buildShareMarkdown(RECORD, "https://taskmind.app/share/enc:x", {
        includeInput: false,
      });
      expect(md).not.toContain("## Raw input");
    });
  });
});
