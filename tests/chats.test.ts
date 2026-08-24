import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PUT, DELETE } from "@/app/api/chats/route";
import type { ChatTopic } from "@/lib/types";

vi.mock("@/lib/auth/cookies", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/auth/users", () => ({
  MAX_CHAT_MESSAGES: 200,
  getChatTopicsByRecord: vi.fn(),
  upsertChatTopic: vi.fn(),
  deleteChatTopicsByRecord: vi.fn(),
}));

import { getCurrentUserId } from "@/lib/auth/cookies";
import {
  getChatTopicsByRecord,
  upsertChatTopic,
  deleteChatTopicsByRecord,
} from "@/lib/auth/users";

const TOPIC: ChatTopic = {
  id: "topic-1",
  recordId: "record-1",
  title: "What does this mean?",
  createdAt: 1_000,
  updatedAt: 2_000,
  context: {
    input: "Please send the report by Friday.",
    analysis: {
      summary: "A report is due Friday.",
      actions: ["Send the report"],
      deadlines: ["Friday"],
      urgency: "Important",
      urgencyReason: "Deadline this week",
      urgencyConfidence: 0.8,
      confusingParts: [],
      nextStep: "Send the report",
      nextStepActionIndex: 0,
      analysisMethod: "ai",
    },
  },
  messages: [
    { role: "user", content: "What does this mean?" },
    { role: "assistant", content: "It means a report is due Friday." },
  ],
};

function jsonRequest(
  url: string,
  method: string,
  body?: unknown
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("GET /api/chats", () => {
  it("requires a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await GET(
      jsonRequest("http://localhost/api/chats?recordId=record-1", "GET")
    );
    expect(res.status).toBe(401);
  });

  it("requires a recordId param", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    const res = await GET(jsonRequest("http://localhost/api/chats", "GET"));
    expect(res.status).toBe(400);
  });

  it("returns the topics for the signed-in user's record", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getChatTopicsByRecord).mockResolvedValue([TOPIC]);
    const res = await GET(
      jsonRequest(
        "http://localhost/api/chats?recordId=" + encodeURIComponent("record-1"),
        "GET"
      )
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { topics: ChatTopic[] };
    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].id).toBe("topic-1");
    // Repo is always scoped to the session user — never client-supplied.
    expect(getChatTopicsByRecord).toHaveBeenCalledWith("user-1", "record-1");
  });
});

describe("PUT /api/chats", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  });

  it("requires a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await PUT(
      jsonRequest("http://localhost/api/chats", "PUT", { topic: TOPIC })
    );
    expect(res.status).toBe(401);
  });

  it("rejects an invalid topic with 400", async () => {
    const res = await PUT(
      jsonRequest("http://localhost/api/chats", "PUT", {
        topic: { id: "", recordId: "record-1" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("upserts a valid topic (server stamps updated_at)", async () => {
    const res = await PUT(
      jsonRequest("http://localhost/api/chats", "PUT", { topic: TOPIC })
    );
    expect(res.status).toBe(200);
    expect(upsertChatTopic).toHaveBeenCalledWith("user-1", TOPIC);
  });

  it("drops malformed turns and caps the message list", async () => {
    const flooded = {
      ...TOPIC,
      messages: [
        ...Array.from({ length: 260 }, (_, i) => ({
          role: i % 2 ? ("assistant" as const) : ("user" as const),
          content: `turn ${i}`,
        })),
        { role: "system", content: "injected" }, // invalid role → dropped
        { role: "user" }, // missing content → dropped
      ],
    };
    const res = await PUT(
      jsonRequest("http://localhost/api/chats", "PUT", { topic: flooded })
    );
    expect(res.status).toBe(200);
    const saved = vi.mocked(upsertChatTopic).mock.calls[0][1];
    expect(saved.messages.length).toBeLessThanOrEqual(200);
    for (const m of saved.messages) {
      expect(["user", "assistant"]).toContain(m.role);
      expect(typeof m.content).toBe("string");
    }
  });
});

describe("DELETE /api/chats", () => {
  it("deletes every topic of the record, scoped to the user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(deleteChatTopicsByRecord).mockResolvedValue(1);
    const res = await DELETE(
      jsonRequest(
        "http://localhost/api/chats?recordId=" + encodeURIComponent("record-1"),
        "DELETE"
      )
    );
    expect(res.status).toBe(200);
    expect(deleteChatTopicsByRecord).toHaveBeenCalledWith("user-1", "record-1");
  });

  it("requires a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await DELETE(
      jsonRequest("http://localhost/api/chats?recordId=record-1", "DELETE")
    );
    expect(res.status).toBe(401);
  });
});
