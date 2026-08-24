import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  streamChatCompletion,
  ChatProviderError,
  ChatCancelledError,
  normalizeChatError,
} from "@/lib/chat/provider";
import { resolveChatConfig } from "@/lib/chat/config";

function sseResponse(chunks: string[], init?: ResponseInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    ...init,
  });
}

function deltaChunks(text: string): string[] {
  const third = Math.max(1, Math.floor(text.length / 3));
  const parts = [text.slice(0, third), text.slice(third, 2 * third), text.slice(2 * third)];
  return [
    ...parts.map(
      (p) => `data: ${JSON.stringify({ model: "test/free-model", choices: [{ delta: { content: p } }] })}\n\n`
    ),
    "data: [DONE]\n\n",
  ];
}

const CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://openrouter.test/api/v1",
  model: "openrouter/free",
  temperature: 0.2,
  maxTokens: 800,
  timeoutMs: 5_000,
  maxAttempts: 3,
};

describe("resolveChatConfig", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses chat-specific variables when present", () => {
    process.env = {
      ...originalEnv,
      OPENROUTER_CHAT_API_KEY: "chat-key",
      OPENROUTER_CHAT_BASE_URL: "https://chat.example/v1/",
      OPENROUTER_CHAT_MODEL: "some/model:free",
      OPENROUTER_API_KEY: "general-key",
    };
    const resolved = resolveChatConfig();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config.apiKey).toBe("chat-key");
      // Trailing slashes are stripped.
      expect(resolved.config.baseUrl).toBe("https://chat.example/v1");
      expect(resolved.config.model).toBe("some/model:free");
    }
  });

  it("falls back to the general OpenRouter key and official base URL", () => {
    process.env = { ...originalEnv, OPENROUTER_API_KEY: "general-key" };
    delete process.env.OPENROUTER_CHAT_API_KEY;
    delete process.env.OPENROUTER_CHAT_BASE_URL;
    delete process.env.OPENROUTER_CHAT_MODEL;
    const resolved = resolveChatConfig();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config.apiKey).toBe("general-key");
      expect(resolved.config.baseUrl).toBe("https://openrouter.ai/api/v1");
      expect(resolved.config.model).toBe("openrouter/free");
    }
  });

  it("reports a missing key instead of crashing", () => {
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_CHAT_API_KEY;
    const resolved = resolveChatConfig();
    expect(resolved).toEqual({ ok: false, problem: "missing-api-key" });
  });

  it("rejects an invalid base URL", () => {
    process.env = {
      ...originalEnv,
      OPENROUTER_CHAT_API_KEY: "k",
      OPENROUTER_CHAT_BASE_URL: "not a url",
    };
    expect(resolveChatConfig()).toEqual({ ok: false, problem: "invalid-base-url" });
  });

  it("rejects a whitespace/malformed model override", () => {
    process.env = {
      ...originalEnv,
      OPENROUTER_CHAT_API_KEY: "k",
      OPENROUTER_CHAT_MODEL: 'bad "model"',
    };
    expect(resolveChatConfig()).toEqual({ ok: false, problem: "invalid-model" });
  });
});

describe("streamChatCompletion", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      OPENROUTER_CHAT_API_KEY: "test-key",
      OPENROUTER_CHAT_BASE_URL: "https://openrouter.test/api/v1",
      OPENROUTER_CHAT_TIMEOUT_MS: "5000",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("accumulates SSE deltas and returns content + actual routed model", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse(deltaChunks("Grounded answer about the analysis"))
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await streamChatCompletion(
      [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
      (acc) => deltas.push(acc)
    );

    expect(result.content).toBe("Grounded answer about the analysis");
    expect(result.actualModel).toBe("test/free-model");
    expect(deltas.length).toBe(3);

    // Request construction: endpoint, auth, logical model, streaming body.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.test/api/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["X-Title"]).toBe("TaskMind");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("openrouter/free");
    expect(body.stream).toBe(true);
    expect(body.messages).toHaveLength(2);
  });

  it("ignores OpenRouter keep-alive comment lines", async () => {
    const chunks = [
      ": OPENROUTER PROCESSING\n\n",
      ...deltaChunks("ok"),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const result = await streamChatCompletion(
      [{ role: "user", content: "q" }],
      () => {}
    );
    expect(result.content).toBe("ok");
  });

  it("classifies 401 as auth without retrying", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Invalid key" } }), {
          status: 401,
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamChatCompletion([{ role: "user", content: "q" }, ], () => {})).rejects.toMatchObject({
      kind: "auth",
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 429 as rate-limit, captures Retry-After, does not retry without a hint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), {
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], () => {})
    ).rejects.toMatchObject({ kind: "rate-limit" });
    expect(fetchMock).toHaveBeenCalledTimes(CONFIG.maxAttempts > 1 ? 1 : 1);
  });

  it("honors a short explicit Retry-After on 429 exactly once more", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), {
        status: 429,
        headers: { "Retry-After": "0" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], () => {}, {
        config: { ...CONFIG },
      })
    ).rejects.toMatchObject({ kind: "rate-limit" });
    // First attempt + one Retry-After-honoring retry; then gives up.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient 503s before any content and succeeds", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "No provider available" } }), {
          status: 503,
        }),
    );
    // Fail twice, then succeed.
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call += 1;
      if (call <= 2) {
        return new Response(JSON.stringify({ error: { message: "down" } }), {
          status: 503,
        });
      }
      return sseResponse(deltaChunks("recovered"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamChatCompletion(
      [{ role: "user", content: "q" }],
      () => {},
      { config: CONFIG }
    );
    expect(result.content).toBe("recovered");
    expect(result.attempts).toBe(3);
  });

  it("never retries after a partial delivery", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        // Stream one delta, then fail mid-stream.
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "partial" } }] })}\n\n`
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ error: { code: 502, message: "upstream exploded" } })}\n\n`
              )
            );
            controller.close();
          },
        });
        return new Response(body, { status: 200 });
      }
      throw new Error("should not be called again");
    });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], (acc) => deltas.push(acc), {
        config: CONFIG,
      })
    ).rejects.toMatchObject({ kind: "provider" });

    expect(deltas).toEqual(["partial"]);
    expect(call).toBe(1); // no retry after delivered content
  });

  it("treats mid-stream rate limits (finish_reason error chunks) as rate-limit failures", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              error: { code: 429, message: "Rate limit exceeded" },
              choices: [{ delta: { content: "" }, finish_reason: "error" }],
            })}\n\n`
          )
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 200 }))
    );

    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], () => {})
    ).rejects.toMatchObject({ kind: "rate-limit" });
  });

  it("throws unconfigured when no API key is resolvable", async () => {
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_CHAT_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], () => {})
    ).rejects.toMatchObject({ kind: "unconfigured" });
  });

  it("propagates caller cancellation without retrying", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = streamChatCompletion([{ role: "user", content: "q" }], () => {}, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(ChatCancelledError);
  });

  it("throws invalid-response on an empty stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse(["data: [DONE]\n\n"]))
    );
    await expect(
      streamChatCompletion([{ role: "user", content: "q" }], () => {})
    ).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("normalizeChatError", () => {
  it("maps quota phrases to quota (but not 429)", () => {
    expect(normalizeChatError(new Error("insufficient credits")).kind).toBe("quota");
    const rl = normalizeChatError(Object.assign(new Error("out of credits"), { status: 429 }));
    expect(rl.kind).toBe("rate-limit");
  });

  it("maps TypeErrors to network", () => {
    expect(normalizeChatError(new TypeError("fetch failed")).kind).toBe("network");
  });

  it("keeps ChatProviderError instances intact", () => {
    const original = new ChatProviderError("x", "auth");
    expect(normalizeChatError(original)).toBe(original);
  });
});
