import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AIClient } from "@/lib/ai";
import { validateAndRepairAnalysis, analyzeRawResponse } from "@/lib/validateAnalysis";
import { buildAnalysisMessages, PROMPT_VERSION } from "@/lib/prompts";
import type { AnalysisResult } from "@/app/actions/analyzeText";

const VALID_RESULT = {
  actions: ["Submit the report"],
  deadlines: ["Friday"],
  urgency: "Important",
  urgencyReason: "Deadline this week",
  urgencyConfidence: 0.8,
  confusingParts: [
    {
      sentence: "Penalties unclear.",
      explanation: "The exact penalties are not specified.",
      reason: "missing-info",
      severity: "medium",
    },
  ],
  nextStep: "Submit the report",
  nextStepReason: "Only action",
  nextStepActionIndex: 0,
  summary: "Submit the report by Friday; penalties for lateness are unclear.",
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function fetchMockImpl(responses: Array<Response | (() => Promise<Response> | Response)>) {
  let call = 0;
  return vi.fn(async () => {
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return typeof next === "function" ? next() : next;
  });
}

describe("validateAnalysis", () => {
  it("parses and validates a valid response", () => {
    const { result, repaired } = analyzeRawResponse(JSON.stringify(VALID_RESULT));
    expect(repaired).toBe(false);
    expect(result.actions).toEqual(["Submit the report"]);
    expect(result.urgency).toBe("Important");
    expect(result.analysisMethod).toBe("ai");
  });

  it("strips markdown fences", () => {
    const result = validateAndRepairAnalysis("```json\n" + JSON.stringify(VALID_RESULT) + "\n```");
    expect(result.actions[0]).toBe("Submit the report");
  });

  it("repairs missing fields and clamps invalid urgency", () => {
    const { result, repaired } = analyzeRawResponse({
      actions: null,
      deadlines: [123, "Friday"],
      urgency: "URGENT!",
      confusingParts: undefined,
      nextStep: 42,
      summary: "  ",
    });
    expect(repaired).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.deadlines).toEqual(["Friday"]);
    expect(result.urgency).toBe("Informational");
    expect(result.nextStep).toBe("No action specified");
    expect(result.summary).toBe("");
  });

  it("coerces string primitives and standardizes urgency casing (OpenRouter variations)", () => {
    const { result, repaired } = analyzeRawResponse({
      actions: "Submit the report, Call the office",
      deadlines: "Friday; Monday",
      urgency: "important",
      confusingParts: { sentence: "What now?", explanation: "Not clear." },
      nextStep: "Submit the report",
      nextStepReason: "Only action",
      nextStepActionIndex: 0,
      summary: "Do it soon.",
    });
    expect(repaired).toBe(true);
    expect(result.actions).toEqual(["Submit the report", "Call the office"]);
    expect(result.deadlines).toEqual(["Friday", "Monday"]);
    expect(result.urgency).toBe("Important");
    expect(result.confusingParts).toHaveLength(1);
    expect(result.confusingParts[0].sentence).toBe("What now?");
  });

  it("salvages truncated JSON via completed fields", () => {
    const partial =
      '{"actions": ["Do the thing", "And another"], "deadlines": ["tomorrow"], "urgency": "Important", "summary": "Do t';
    const { result } = analyzeRawResponse(partial);
    expect(result.actions).toContain("Do the thing");
    expect(result.deadlines).toEqual(["tomorrow"]);
    expect(result.urgency).toBe("Important");
  });

  it("throws on non-object JSON", () => {
    expect(() => validateAndRepairAnalysis("42")).toThrow();
    expect(() => validateAndRepairAnalysis('"hello"')).toThrow();
  });

  it("throws on empty / low-quality output", () => {
    expect(() =>
      validateAndRepairAnalysis(JSON.stringify({ actions: [], deadlines: [], confusingParts: [], nextStep: "", summary: "" }))
    ).toThrow("no usable content");
  });

  it("dedupes actions and sanitizes summary markup", () => {
    const { result } = analyzeRawResponse({
      actions: ["Do X", "Do X", "<b>Do Y</b>"],
      deadlines: [],
      urgency: "Informational",
      confusingParts: [],
      nextStep: "Do X",
      summary: "plain **markdown** <i>html</i>",
    });
    expect(result.actions).toEqual(["Do X", "Do Y"]);
    expect(result.summary).not.toMatch(/<i>|\*\*/);
  });
});

describe("prompts", () => {
  it("builds messages with system prompt + few-shot + input", () => {
    const messages = buildAnalysisMessages("hello");
    expect(messages[0].role).toBe("system");
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: 'Analyze this message: "hello"',
    });
    expect(messages.length).toBeGreaterThanOrEqual(5);
    expect(PROMPT_VERSION).toBeTruthy();
  });
});

describe("AIClient.analyzeStructured", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      TOKENROUTER_API_KEY: "test-key",
      TOKENROUTER_BASE_URL: "https://api.testrouter.test/v1",
      TOKENROUTER_MODEL: "model-a",
      TOKENROUTER_MODEL_FALLBACKS: "model-b",
      TOKENROUTER_MAX_ATTEMPTS: "3",
      TOKENROUTER_TIMEOUT_MS: "5000",
      // Isolate this suite to the primary provider (fallback tests live in
      // their own describe block below).
      OPENROUTER_API_KEY: "",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns a validated result on success", async () => {
    vi.stubGlobal("fetch", fetchMockImpl([jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }], usage: { total_tokens: 42 } })]));
    const client = new AIClient();
    const { result, usage } = await client.analyzeStructured("test input");
    expect(result.actions[0]).toBe("Submit the report");
    expect(usage.model).toBe("model-a");
    expect(usage.attempt).toBe(1);
    expect(usage.tokenUsage?.totalTokens).toBe(42);
  });

  it("retries on invalid JSON and succeeds with the fallback model", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ choices: [{ message: { content: "not json at all" } }] }),
        jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] }),
      ])
    );
    const client = new AIClient();
    const { result, usage } = await client.analyzeStructured("test input");
    expect(result.analysisMethod).toBe("ai");
    expect(usage.model).toBe("model-b");
    expect(usage.attempt).toBe(2);
  });

  it("fails after repeated 429s with a retryable error", async () => {
    vi.stubGlobal("fetch", fetchMockImpl([
      jsonResponse({ error: { message: "rate limit" } }, { status: 429 }),
      jsonResponse({ error: { message: "rate limit" } }, { status: 429 }),
      jsonResponse({ error: { message: "rate limit" } }, { status: 429 }),
    ]));
    const client = new AIClient();
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/after 3 attempts/);
  });

  it("throws ALL_KEYS_EXHAUSTED on quota errors without retrying models", async () => {
    const fetchMock = fetchMockImpl([
      jsonResponse({ error: { message: "User's credit limit is insufficient" } }, { status: 403 }),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const client = new AIClient();
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/quota exhausted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx and eventually succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ error: { message: "boom" } }, { status: 500 }),
        jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] }),
      ])
    );
    const client = new AIClient();
    const { usage } = await client.analyzeStructured("test input");
    expect(usage.attempt).toBe(2);
  });

  it("handles timeouts (AbortError) as retryable", async () => {
    const abortError = new Error("This operation was aborted");
    abortError.name = "AbortError";
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        () => { throw abortError; },
        jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] }),
      ])
    );
    const client = new AIClient();
    const { usage } = await client.analyzeStructured("test input");
    expect(usage.attempt).toBe(2);
  });

  it("throws on empty response", async () => {
    vi.stubGlobal("fetch", fetchMockImpl([jsonResponse({ choices: [{ message: {} }] })]));
    const client = new AIClient();
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/failed after/);
  });

  it("throws API_KEY_EXHAUSTED when no key is configured", async () => {
    // Clear both providers so the client is genuinely unconfigured.
    process.env.TOKENROUTER_API_KEY = "";
    process.env.OPENROUTER_API_KEY = "";
    const client = new AIClient();
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/TOKENROUTER_API_KEY/);
  });

  it("returns a validated AnalysisResult typed value", async () => {
    vi.stubGlobal("fetch", fetchMockImpl([jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] })]));
    const client = new AIClient();
    const { result } = await client.analyzeStructured("test input");
    const r: AnalysisResult = result;
    expect(r.urgency).toBeDefined();
    expect(r.analysisMethod).toBe("ai");
  });
});

describe("AIClient provider fallback (TokenRouter → OpenRouter)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      TOKENROUTER_API_KEY: "tr-key",
      TOKENROUTER_BASE_URL: "https://api.testrouter.test/v1",
      TOKENROUTER_MODEL: "model-a",
      TOKENROUTER_MAX_ATTEMPTS: "1",
      OPENROUTER_API_KEY: "or-key",
      OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
      OPENROUTER_MAX_ATTEMPTS: "1",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("uses TokenRouter when it succeeds and records provider telemetry", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] }),
      ])
    );
    const client = new AIClient();
    const { result, usage } = await client.analyzeStructured("test input");
    expect(usage.provider).toBe("tokenrouter");
    expect(result.aiProviderUsed).toBe("tokenrouter");
    const diagnostics = client.getDiagnostics();
    expect(diagnostics.lastProviderUsed).toBe("tokenrouter");
    expect(diagnostics.fallbackOccurred).toBe(false);
    expect(diagnostics.providerErrors.tokenrouter.count).toBe(0);
  });

  it("falls back to OpenRouter when TokenRouter fails", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ error: { message: "boom" } }, { status: 500 }),
        jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }] }),
      ])
    );
    const client = new AIClient();
    const { result, usage } = await client.analyzeStructured("test input");
    expect(usage.provider).toBe("openrouter");
    expect(usage.model).toBe("anthropic/claude-3.5-sonnet");
    expect(result.analysisMethod).toBe("ai");
    expect(result.aiProviderUsed).toBe("openrouter");
    const diagnostics = client.getDiagnostics();
    expect(diagnostics.lastProviderUsed).toBe("openrouter");
    expect(diagnostics.fallbackOccurred).toBe(true);
    expect(diagnostics.providerErrors.tokenrouter.count).toBe(1);
    expect(diagnostics.providerErrors.tokenrouter.lastStatus).toBe(500);
  });

  it("skips to OpenRouter when the TokenRouter circuit breaker is open", async () => {
    // Model-aware mock: TokenRouter always 500s, OpenRouter always succeeds,
    // so the primary accumulates failures without tripping the secondary.
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model?: string };
      if (body.model === "model-a") {
        return jsonResponse({ error: { message: "boom" } }, { status: 500 });
      }
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new AIClient();
    // First three calls: TokenRouter fails, OpenRouter serves the result.
    for (let i = 0; i < 3; i++) {
      const { usage } = await client.analyzeStructured("test input");
      expect(usage.provider).toBe("openrouter");
    }
    expect(client.getDiagnostics().providerCircuitBreaker.tokenrouter).toEqual({
      failures: 3,
      open: true,
    });

    // Fourth call: TokenRouter breaker is open → OpenRouter serves it directly
    // (no attempt is made against the primary).
    const before = fetchMock.mock.calls.length;
    const { usage } = await client.analyzeStructured("test input");
    expect(usage.provider).toBe("openrouter");
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });

  it("propagates quota errors when both providers are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ error: { message: "insufficient credits" } }, { status: 403 }),
        jsonResponse({ error: { message: "out of credits" } }, { status: 402 }),
      ])
    );
    const client = new AIClient();
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/quota exhausted/);
    const diagnostics = client.getDiagnostics();
    expect(diagnostics.providerErrors.openrouter.lastClass).toBe("quota");
  });

  it("reports the primary error when only the secondary hits quota", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockImpl([
        jsonResponse({ error: { message: "boom" } }, { status: 500 }),
        jsonResponse({ error: { message: "out of credits" } }, { status: 402 }),
      ])
    );
    const client = new AIClient();
    // The primary's failure is the honest story — not a blanket quota notice.
    await expect(client.analyzeStructured("test input")).rejects.toThrow(/boom/);
  });
});

describe("AIClient.streamStructured", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      TOKENROUTER_API_KEY: "test-key",
      TOKENROUTER_MAX_ATTEMPTS: "2",
      OPENROUTER_API_KEY: "",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("accumulates SSE deltas", async () => {
    const full = JSON.stringify(VALID_RESULT);
    const third = Math.floor(full.length / 3);
    const parts = [full.slice(0, third), full.slice(third, 2 * third), full.slice(2 * third)];
    const sseChunks = [
      ...parts.map(
        (p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`
      ),
      "data: [DONE]\n\n",
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of sseChunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      fetchMockImpl([new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })])
    );
    const client = new AIClient();
    const deltas: string[] = [];
    const { content } = await client.streamStructured("test input", (acc) => deltas.push(acc));
    expect(content).toBe(full);
    expect(deltas.length).toBe(3);
    expect(validateAndRepairAnalysis(content).actions[0]).toBe("Submit the report");
  });

  it("retries when the stream errors before any content", async () => {
    const sseResponse = (status: number, payload?: string) => {
      const chunks =
        status === 200
          ? `data: ${JSON.stringify({ choices: [{ delta: { content: payload } }] })}\n\ndata: [DONE]\n\n`
          : "";
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          if (chunks) controller.enqueue(new TextEncoder().encode(chunks));
          controller.close();
        },
      });
      return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
    };

    const full = JSON.stringify(VALID_RESULT);
    vi.stubGlobal("fetch", fetchMockImpl([sseResponse(500), sseResponse(200, full)]));
    const client = new AIClient();
    const { content } = await client.streamStructured("test input", () => {});
    expect(content).toBe(full);
  });
});
