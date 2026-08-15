import { describe, it, expect } from "vitest";
import {
  encryptSharePayload,
  decryptShareToken,
  SHARE_PREFIX,
} from "@/lib/share-crypto";
import { buildShareMarkdown } from "@/lib/share";

const SECRET = "test-share-secret-for-aes-gcm";
const OTHER_SECRET = "a-different-secret-value";

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
  timestamp: Date.now(),
};

describe("share token crypto", () => {
  describe("encryptSharePayload / decryptShareToken", () => {
    it("round-trips a payload through an encrypted token", () => {
      const token = encryptSharePayload(RECORD, SECRET);
      expect(token.startsWith(SHARE_PREFIX)).toBe(true);
      const payload = decryptShareToken(token, SECRET);
      expect(payload).not.toBeNull();
      expect(payload?.output).toEqual(RECORD.output);
      expect(payload?.input).toBe(RECORD.input);
      expect(payload?.timestamp).toBe(RECORD.timestamp);
    });

    it("carries optional share options", () => {
      const token = encryptSharePayload(
        { ...RECORD, includeInput: false, sensitive: true },
        SECRET
      );
      const payload = decryptShareToken(token, SECRET);
      expect(payload?.includeInput).toBe(false);
      expect(payload?.sensitive).toBe(true);
    });

    it("does not leak the plaintext into the token", () => {
      const token = encryptSharePayload(RECORD, SECRET);
      expect(token).not.toContain("Submit the report");
    });

    it("rejects tampered tokens (authenticated encryption)", () => {
      const token = encryptSharePayload(RECORD, SECRET);
      expect(decryptShareToken(token.slice(0, -1), SECRET)).toBeNull();
      const flipped =
        token.slice(0, 4) + (token[4] === "A" ? "B" : "A") + token.slice(5);
      expect(decryptShareToken(flipped, SECRET)).toBeNull();
    });

    it("rejects tokens encrypted with a different secret", () => {
      const token = encryptSharePayload(RECORD, SECRET);
      expect(decryptShareToken(token, OTHER_SECRET)).toBeNull();
    });

    it("rejects expired tokens (older than the share TTL)", () => {
      const old = {
        ...RECORD,
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
      };
      const token = encryptSharePayload(old, SECRET);
      expect(decryptShareToken(token, SECRET)).toBeNull();
    });

    it("rejects tokens stamped in the future (clock skew)", () => {
      const future = { ...RECORD, timestamp: Date.now() + 10 * 60 * 1000 };
      const token = encryptSharePayload(future, SECRET);
      expect(decryptShareToken(token, SECRET)).toBeNull();
    });

    it("decodes tokens whose prefix colon was percent-encoded (route params)", () => {
      const token = encryptSharePayload(RECORD, SECRET);
      const encoded = token.replace("enc:", "enc%3A");
      const payload = decryptShareToken(encoded, SECRET);
      expect(payload).not.toBeNull();
      expect(payload?.output).toEqual(RECORD.output);
    });

    it("returns null for invalid tokens", () => {
      expect(decryptShareToken("not-a-token", SECRET)).toBeNull();
      expect(decryptShareToken("", SECRET)).toBeNull();
    });
  });

  describe("legacy (pre-encryption) tokens", () => {
    it("still decodes old base64url tokens for backward compatibility", () => {
      const json = JSON.stringify(RECORD);
      const legacy = Buffer.from(json, "utf8").toString("base64url");
      const payload = decryptShareToken(legacy, SECRET);
      expect(payload).not.toBeNull();
      expect(payload?.output).toEqual(RECORD.output);
    });

    it("rejects malformed legacy tokens", () => {
      expect(decryptShareToken("not-base64!!!", SECRET)).toBeNull();
    });
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
