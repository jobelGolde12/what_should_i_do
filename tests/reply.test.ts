import { describe, it, expect } from "vitest";
import {
  buildReplyMessages,
  REPLY_SYSTEM_PROMPT,
  REPLY_PROMPT_VERSION,
  TONE_PRESETS,
  type ReplyTone,
} from "@/lib/prompts";
import { fallbackReply } from "@/lib/replyFallback";
import { draftReply } from "@/app/actions/draftReply";
import type { AnalysisResult } from "@/app/actions/analyzeText";

const TONES: ReplyTone[] = ["professional", "casual", "brief", "warm"];

const MESSAGE =
  "Hi, please submit the final report to the online portal by Friday. Late submissions may incur penalties.";

const ANALYSIS: AnalysisResult = {
  actions: ["Submit the final report via the online portal"],
  deadlines: ["Friday"],
  urgency: "Important",
  urgencyReason: "Upcoming submission deadline later this week",
  urgencyConfidence: 0.8,
  confusingParts: [],
  nextStep: "Submit the final report via the online portal",
  nextStepActionIndex: 0,
  summary:
    "Submit the final report via the online portal by Friday; penalties for late submission are unclear.",
  analysisMethod: "ai",
};

describe("reply prompt assembly", () => {
  it("declares a versioned prompt", () => {
    expect(REPLY_PROMPT_VERSION).toMatch(/^v\d+$/);
  });

  it("defines all tones with non-empty presets", () => {
    for (const tone of TONES) {
      expect(TONE_PRESETS[tone].trim().length).toBeGreaterThan(10);
    }
  });

  it("includes the tone, original message, and analysis in the request", () => {
    const messages = buildReplyMessages({
      message: MESSAGE,
      analysis: ANALYSIS,
      tone: "brief",
    });
    expect(messages[0].content).toBe(REPLY_SYSTEM_PROMPT);
    const user = messages[1].content;
    expect(user).toContain(MESSAGE);
    expect(user).toContain("Submit the final report via the online portal");
    expect(user).toContain(TONE_PRESETS.brief);
  });

  it("never instructs the model to emit HTML or markdown formatting", () => {
    const lower = REPLY_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toContain("<html");
    expect(lower).not.toContain("<p>");
    expect(lower).not.toContain("<h1");
    expect(lower).not.toContain("**");
    expect(lower).toContain("plain text only");
    expect(lower).toContain("no html");
    expect(lower).toContain("no markdown");
  });
});

describe("fallback reply builder", () => {
  it("acknowledges the message and includes the first action", () => {
    const draft = fallbackReply(MESSAGE, ANALYSIS, "professional");
    expect(draft).toContain("Thanks for your message");
    expect(draft).toContain("Submit the final report");
    expect(draft).toContain("Next step:");
  });

  it("mentions the first deadline when one exists", () => {
    const draft = fallbackReply(MESSAGE, ANALYSIS, "brief");
    expect(draft.toLowerCase()).toContain("friday");
  });

  it("asks follow-up questions when the analysis flags confusion", () => {
    const withConfusion: AnalysisResult = {
      ...ANALYSIS,
      confusingParts: [
        {
          sentence: "Late submissions might have penalties.",
          explanation: "Penalties are unspecified.",
          reason: "missing-info",
          severity: "medium",
        },
      ],
    };
    const draft = fallbackReply(MESSAGE, withConfusion, "casual");
    expect(draft).toContain("Follow-up questions:");
  });

  it("produces a different voice per tone", () => {
    const casual = fallbackReply(MESSAGE, ANALYSIS, "casual");
    const warm = fallbackReply(MESSAGE, ANALYSIS, "warm");
    expect(casual).not.toBe(warm);
  });
});

describe("draftReply input validation", () => {
  it("rejects an empty message", async () => {
    await expect(
      draftReply({ message: "   ", analysis: ANALYSIS, tone: "brief" })
    ).rejects.toThrow("Message is empty");
  });

  it("rejects an oversized message", async () => {
    const long = "x".repeat(51_000);
    await expect(
      draftReply({ message: long, analysis: ANALYSIS, tone: "brief" })
    ).rejects.toThrow("at most 50000 characters");
  });

  it("rejects an invalid tone", async () => {
    await expect(
      draftReply({ message: MESSAGE, analysis: ANALYSIS, tone: "angry" })
    ).rejects.toThrow("valid tone");
  });
});
