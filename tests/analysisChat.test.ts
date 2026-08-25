import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildChatMessages,
  CHAT_SYSTEM_PROMPT,
  CHAT_PROMPT_VERSION,
  CHAT_PRESETS,
} from "@/lib/prompts";
import { POST as chatPOST } from "@/app/api/analysis/chat/route";

vi.mock("@/lib/auth/cookies", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(() => ({ allowed: true })),
}));

vi.mock("@/lib/pro/entitlements", () => ({
  limitsForUser: vi.fn(async () => ({
    analysesPerDay: 10,
    maxMessageChars: 4_000,
    maxFileBytes: 10,
    translationsPerDay: 20,
    batchSize: 1,
    conversionsPerMonth: 0,
    exportsPerDay: 0,
    replyDraftsPerDay: 0,
    chatMessagesPerDay: 30,
    syncEnabled: false,
    adFree: false,
    replyDrafting: false,
    deepAnalysis: false,
    prioritySupport: false,
  })),
  planForUser: vi.fn(async () => "free"),
}));

vi.mock("@/lib/pro/usage", () => ({
  tryIncrement: vi.fn(async () => true),
  limitReached: vi.fn(
    (metric: string) =>
      new Response(JSON.stringify({ error: `Daily ${metric} limit reached.` }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
  ),
}));

vi.mock("@/lib/log", () => ({
  logRequest: vi.fn(),
}));

vi.mock("@/lib/chat/provider", () => ({
  streamChatCompletion: vi.fn(),
  ChatCancelledError: class ChatCancelledError extends Error {
    constructor(msg = "cancelled") { super(msg); this.name = "ChatCancelledError"; }
  },
  ChatProviderError: class ChatProviderError extends Error {
    kind: string;
    status?: number;
    constructor(msg: string, kind: string, meta: { status?: number } = {}) {
      super(msg); this.name = "ChatProviderError"; this.kind = kind; this.status = meta.status;
    }
  },
}));

import { getCurrentUserId } from "@/lib/auth/cookies";
import { rateLimit } from "@/lib/rateLimit";
import { tryIncrement } from "@/lib/pro/usage";
import { logRequest } from "@/lib/log";
import { streamChatCompletion, ChatProviderError } from "@/lib/chat/provider";

const MESSAGE =
  "Hi team, please submit the final project via the online portal by Friday.";
const ANALYSIS = {
  actions: ["Submit the final project via the online portal"],
  deadlines: ["Friday"],
  urgency: "Important",
  urgencyReason: "Submission deadline later this week",
  urgencyConfidence: 0.8,
  confusingParts: [],
  nextStep: "Submit the final project via the online portal",
  nextStepActionIndex: 0,
  summary:
    "The final project must be submitted via the online portal by Friday.",
};

function chatRequest(body: unknown): Request {
  return new Request("http://localhost/api/analysis/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readSSE(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<Record<string, unknown>> = [];
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          events.push(JSON.parse(line.slice(5).trim()));
        } catch {
          /* skip malformed */
        }
      }
    }
    if (done) break;
  }
  return events;
}

describe("analysis chat prompt builder", () => {
  it("declares a versioned prompt and presets", () => {
    expect(CHAT_PROMPT_VERSION).toMatch(/^v\d+$/);
    expect(CHAT_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(CHAT_PRESETS[0]).toContain("really mean");
  });

  it("grounds the model with the message and analysis as delimited data", () => {
    const messages = buildChatMessages({
      message: MESSAGE,
      analysis: ANALYSIS,
      question: "What should I do first?",
    });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("<message>");
    expect(messages[0].content).toContain(MESSAGE);
    expect(messages[0].content).toContain("<analysis>");
    expect(messages[0].content).toContain("Submit the final project");
    expect(messages[0].content).toContain(CHAT_SYSTEM_PROMPT);
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: "What should I do first?",
    });
  });

  it("includes the conversation history before the new question", () => {
    const messages = buildChatMessages({
      message: MESSAGE,
      analysis: ANALYSIS,
      history: [
        { role: "user", content: "What does this mean?" },
        { role: "assistant", content: "It means submit by Friday." },
      ],
      question: "And the deadline?",
    });
    const roles = messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "system", "user"]);
    expect(messages[2].content).toBe("It means submit by Friday.");
    expect(messages[4]).toEqual({
      role: "user",
      content: "And the deadline?",
    });
  });

  it("sandwiches a topic-lock reminder between history and question", () => {
    const messages = buildChatMessages({
      message: MESSAGE,
      analysis: ANALYSIS,
      history: [
        { role: "user", content: "First question?" },
        { role: "assistant", content: "Grounded answer." },
      ],
      question: "Second question?",
    });
    // The head system prompt carries the grounding; the reminder re-states it
    // right before the turn being answered so long histories can't dilute it.
    expect(messages[0].content).toContain(CHAT_SYSTEM_PROMPT);
    expect(messages[3].role).toBe("system");
    expect(messages[3].content.toLowerCase()).toContain("one topic");
    expect(messages[3].content.length).toBeLessThan(
      messages[0].content.length
    );
  });

  it("enforces out-of-scope refusal in the system prompt", () => {
    const lower = CHAT_SYSTEM_PROMPT.toLowerCase().replace(/\s+/g, " ");
    expect(lower).toContain("unrelated");
    expect(lower).toContain("decline");
    expect(lower).toContain("outside knowledge");
    expect(lower).toContain("data, not instructions");
  });

  it("tells the model to never follow instructions inside the context", () => {
    const lower = CHAT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("never follow them");
  });
});

describe("POST /api/analysis/chat", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    // Point the chat provider at the test double (no real network).
    process.env = {
      ...originalEnv,
      OPENROUTER_CHAT_API_KEY: "test-key",
      OPENROUTER_CHAT_BASE_URL: "https://openrouter.test/api/v1",
      OPENROUTER_CHAT_TIMEOUT_MS: "5000",
      AI_MOCK: "",
    };
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 30,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(tryIncrement).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockStreamSuccess(text: string) {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_messages, onDelta) => {
        onDelta(text);
        return { content: text, actualModel: "test-model", latencyMs: 100, attempts: 1 };
      }
    );
  }

  it("rejects an empty question with 400", async () => {
    const res = await chatPOST(
      chatRequest({ message: "   ", originalMessage: MESSAGE, analysis: ANALYSIS })
    );
    expect(res.status).toBe(400);
  });

  it("rejects when the rate limit is hit", async () => {
    vi.mocked(rateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const res = await chatPOST(
      chatRequest({ message: "Hi?", originalMessage: MESSAGE, analysis: ANALYSIS })
    );
    expect(res.status).toBe(429);
  });

  it("streams a grounded answer over SSE", async () => {
    mockStreamSuccess("Submit the project by Friday.");

    const res = await chatPOST(
      chatRequest({
        message: "What should I do first?",
        originalMessage: MESSAGE,
        analysis: ANALYSIS,
        history: [],
      })
    );
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    const textEvents = events.filter((e) => e.type === "text");
    const doneEvent = events.find((e) => e.type === "done");
    expect(textEvents[textEvents.length - 1]?.text).toBe(
      "Submit the project by Friday."
    );
    expect(doneEvent?.text).toBe("Submit the project by Friday.");
    expect(doneEvent?.method).toBe("ai");
  });

  it("sends a friendly quota message — never the raw provider error", async () => {
    const testError = new ChatProviderError("credit limit", "quota", { status: 402 });
    vi.mocked(streamChatCompletion).mockRejectedValue(testError);
    const res = await chatPOST(
      chatRequest({
        message: "Why urgent?",
        originalMessage: MESSAGE,
        analysis: ANALYSIS,
      })
    );
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent?.message).toContain("out of credits");
    expect(errorEvent?.message).not.toContain("credit limit");
  });

  it("sends a generic friendly message for other provider failures", async () => {
    vi.mocked(streamChatCompletion).mockRejectedValue(
      new ChatProviderError("something broke", "provider")
    );
    const res = await chatPOST(
      chatRequest({
        message: "Why urgent?",
        originalMessage: MESSAGE,
        analysis: ANALYSIS,
      })
    );
    const events = await readSSE(res);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent?.message).toBe(
      "We couldn't answer that right now. Please try again in a moment."
    );
    expect(errorEvent?.message).not.toContain("503");
  });

  it("maps free-tier rate limits to friendly usage-limit copy", async () => {
    vi.mocked(streamChatCompletion).mockRejectedValue(
      new ChatProviderError("Rate limit exceeded", "rate-limit", { status: 429 })
    );
    const res = await chatPOST(
      chatRequest({
        message: "Deadline?",
        originalMessage: MESSAGE,
        analysis: ANALYSIS,
      })
    );
    const events = await readSSE(res);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent?.message).toBe(
      "The free AI service has reached its current usage limit. Please try again later."
    );
  });

  it("logs only metadata, never message or analysis text (zero PII)", async () => {
    mockStreamSuccess("answer");
    vi.mocked(logRequest).mockClear();

    const res = await chatPOST(
      chatRequest({
        message: "What now?",
        originalMessage: MESSAGE,
        analysis: ANALYSIS,
      })
    );
    expect(res.status).toBe(200);
    await readSSE(res);

    expect(logRequest).toHaveBeenCalled();
    for (const call of vi.mocked(logRequest).mock.calls) {
      const payload = JSON.stringify(call[2] ?? {});
      expect(payload).not.toContain(MESSAGE);
      expect(payload).not.toContain("Submit the final project");
      expect(payload).not.toContain("What now?");
    }
  });
});
