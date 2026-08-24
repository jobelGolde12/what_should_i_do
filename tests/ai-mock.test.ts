import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isAiMockEnabled,
  extractChatContext,
  classifyQuestion,
  buildGroundedAnswer,
  mockStreamText,
} from "@/lib/ai-mock";
import { buildChatMessages } from "@/lib/prompts";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  delete process.env.AI_MOCK;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

const CONTEXT = buildChatMessages({
  message:
    "Team, please submit the final report via the portal by Friday 5pm. This is critical for the client deliverable.",
  analysis: {
    actions: ["Submit the final report via the portal"],
    deadlines: ["Friday"],
    urgency: "Urgent",
    urgencyReason: "Uses urgent language.",
    nextStep: "Submit the final report",
    summary: "Report due Friday 5pm via portal.",
  },
  history: [],
  question: "placeholder",
});

describe("isAiMockEnabled", () => {
  it("is off by default", () => {
    expect(isAiMockEnabled()).toBe(false);
  });

  it("activates only with AI_MOCK=1 outside production", () => {
    vi.stubEnv("AI_MOCK", "1");
    expect(isAiMockEnabled()).toBe(true);
  });

  it("never activates in production, even with AI_MOCK=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_MOCK", "1");
    expect(isAiMockEnabled()).toBe(false);
  });
});

describe("extractChatContext", () => {
  it("pulls the original message, analysis JSON, and last user question", () => {
    const messages = [
      ...CONTEXT.slice(0, -1),
      { role: "user", content: "What is the deadline here?" },
    ];

    const ctx = extractChatContext(messages);
    expect(ctx.originalMessage).toContain("final report");
    expect(ctx.analysis.deadlines).toEqual(["Friday"]);
    expect(ctx.question).toBe("What is the deadline here?");
  });
});

describe("classifyQuestion", () => {
  const contextTokens = ["team", "please", "submit", "final", "report", "portal",
    "friday", "critical", "client", "deliverable", "actions", "deadlines",
    "urgent", "language", "step", "summary"];

  it("treats chat-domain questions as on-topic", () => {
    for (const q of [
      "What should I do first?",
      "Why is this marked urgent/important?",
      "What should I say in my reply?",
      "Explain the unclear parts in simple words.",
    ]) {
      expect(classifyQuestion(q, contextTokens)).toBe("on-topic");
    }
  });

  it("treats context-word overlap as on-topic", () => {
    expect(classifyQuestion("Who needs to submit the report?", contextTokens)).toBe(
      "on-topic"
    );
  });

  it("rejects unrelated topics", () => {
    expect(classifyQuestion("Write me a poem about cats", [])).toBe("off-topic");
    expect(
      classifyQuestion("Who won the football game last night?", contextTokens)
    ).toBe("off-topic");
  });
});

describe("buildGroundedAnswer", () => {
  const analysis = {
    deadlines: ["Friday"],
    urgency: "Urgent",
    urgencyReason: "Uses urgent language.",
    nextStep: "Submit the final report",
    actions: ["Submit the final report via the portal"],
  };

  it("answers deadline questions from the deadlines field only", () => {
    const answer = buildGroundedAnswer("What is the deadline here?", analysis, "");
    expect(answer).toContain("Friday");
    expect(answer).not.toContain("undefined");
  });

  it("answers next-step questions from nextStep", () => {
    const answer = buildGroundedAnswer("What should I do first?", analysis, "");
    expect(answer).toContain("Submit the final report");
  });

  it("falls back to the original message when nothing else fits", () => {
    const answer = buildGroundedAnswer("Tell me about this", {}, "Hello team. Bye.");
    expect(answer).toContain("Hello team.");
  });
});

describe("mockStreamText", () => {
  it("streams incrementally and resolves to the accumulated text (on-topic)", async () => {
    const messages = [
      ...CONTEXT.slice(0, -1),
      { role: "user", content: "What is the deadline here?" },
    ];
    const deltas: string[] = [];
    const result = await mockStreamText(messages, (acc) => deltas.push(acc), {
      delayMs: 0,
    });

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas[deltas.length - 1]).toBe(result.content);
    expect(result.content).toContain("Friday");
    expect(result.tokenUsage?.totalTokens).toBeGreaterThan(0);
  });

  it("refuses off-topic questions per the topic-lock contract", async () => {
    const messages = [
      ...CONTEXT.slice(0, -1),
      { role: "user", content: "Write me a poem about cats" },
    ];
    const result = await mockStreamText(messages, () => {}, { delayMs: 0 });

    expect(result.content).toMatch(/can only answer questions about/i);
  });

  it("handles malformed or missing system context without throwing", async () => {
    const result = await mockStreamText(
      [{ role: "user", content: "hello?" }],
      () => {},
      { delayMs: 0 }
    );
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });
});
