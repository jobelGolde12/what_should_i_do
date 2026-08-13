import { describe, it, expect } from "vitest";
import { parseBatchMessages } from "@/lib/batch";

describe("parseBatchMessages", () => {
  it("splits on --- separator lines", () => {
    const input = "First message\n\n---\nSecond message\n\n---\nThird message";
    expect(parseBatchMessages(input)).toEqual([
      "First message",
      "Second message",
      "Third message",
    ]);
  });

  it("splits on blank lines when no --- is present", () => {
    const input = "Message one.\n\nMessage two.\n\nMessage three.";
    expect(parseBatchMessages(input)).toEqual([
      "Message one.",
      "Message two.",
      "Message three.",
    ]);
  });

  it("keeps a single message with paragraph breaks whole when --- present", () => {
    const input =
      "Dear team,\n\nThe report is due Friday.\n\n---\nThe meeting moved to Monday.";
    expect(parseBatchMessages(input)).toEqual([
      "Dear team,\n\nThe report is due Friday.",
      "The meeting moved to Monday.",
    ]);
  });

  it("trims and drops empty entries", () => {
    const input = "  A  \n\n   \n\n  B  ";
    expect(parseBatchMessages(input)).toEqual(["A", "B"]);
  });

  it("returns [] for blank input", () => {
    expect(parseBatchMessages("   ")).toEqual([]);
    expect(parseBatchMessages("")).toEqual([]);
  });
});
