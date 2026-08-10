import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendMail,
  isMailgunConfigured,
  mailgunFrom,
  mailgunEndpoint,
  buildAppUrl,
} from "@/lib/mailgun";

const VALID_TO = "test@example.com";
const VALID_SUBJECT = "Test Subject";
const VALID_TEXT = "Test email body";
const VALID_HTML = "<p>Test email body</p>";

describe("Mailgun Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("isMailgunConfigured", () => {
    it("returns true when both API key and domain are configured", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      expect(isMailgunConfigured()).toBe(true);
    });

    it("returns false when API key is missing", () => {
      process.env.MAILGUN_API_KEY = "";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      expect(isMailgunConfigured()).toBe(false);
    });

    it("returns false when domain is missing", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "";
      expect(isMailgunConfigured()).toBe(false);
    });

    it("returns false when both are missing", () => {
      process.env.MAILGUN_API_KEY = "";
      process.env.MAILGUN_DOMAIN = "";
      expect(isMailgunConfigured()).toBe(false);
    });
  });

  describe("mailgunFrom", () => {
    it("returns MAILGUN_FROM when set", () => {
      process.env.MAILGUN_FROM = "sender@example.com";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      expect(mailgunFrom()).toBe("sender@example.com");
    });

    it("returns no-reply@<domain> when MAILGUN_FROM is not set but domain is", () => {
      process.env.MAILGUN_FROM = "";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      expect(mailgunFrom()).toBe("no-reply@test.example.com");
    });

    it("returns default no-reply@taskmind.app when neither is set", () => {
      process.env.MAILGUN_FROM = "";
      process.env.MAILGUN_DOMAIN = "";
      expect(mailgunFrom()).toBe("no-reply@taskmind.app");
    });
  });

  describe("mailgunEndpoint", () => {
    it("returns null when not configured", () => {
      process.env.MAILGUN_API_KEY = "";
      process.env.MAILGUN_DOMAIN = "";
      expect(mailgunEndpoint()).toBeNull();
    });

    it("returns correct endpoint with default base URL", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "mg.example.com";
      // Don't set MAILGUN_BASE_URL to use default
      expect(mailgunEndpoint()).toBe(
        "https://api.mailgun.com/v3/mg.example.com/messages"
      );
    });

    it("returns correct endpoint with custom base URL", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "mg.example.com";
      process.env.MAILGUN_BASE_URL = "https://api.custom.test/v2";
      expect(mailgunEndpoint()).toBe(
        "https://api.custom.test/v2/mg.example.com/messages"
      );
    });

    it("adds /v3 suffix when base URL doesn't contain version", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "mg.example.com";
      process.env.MAILGUN_BASE_URL = "https://api.test.test";
      expect(mailgunEndpoint()).toBe(
        "https://api.test.test/v3/mg.example.com/messages"
      );
    });

    it("does not add /v3 suffix when base URL already contains version", () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "mg.example.com";
      process.env.MAILGUN_BASE_URL = "https://api.test.test/v3";
      expect(mailgunEndpoint()).toBe(
        "https://api.test.test/v3/mg.example.com/messages"
      );
    });
  });

  describe("buildAppUrl", () => {
    it("builds absolute URL with default app URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "";
      expect(buildAppUrl("/test")).toBe("https://taskmind.app/test");
    });

    it("builds absolute URL with custom app URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com";
      expect(buildAppUrl("/test")).toBe("https://custom.example.com/test");
    });

    it("handles trailing slashes correctly", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
      expect(buildAppUrl("/test")).toBe("https://example.com/test");
      expect(buildAppUrl("test")).toBe("https://example.com/test");
    });
  });

  describe("sendMail", () => {
    const mockFetchResponse = (status: number, body: string, init?: ResponseInit) => {
      return new Response(body, { status, headers: { "Content-Type": "application/json", ...init?.headers } });
    };

    it("returns mailgun_not_configured when not configured", async () => {
      process.env.MAILGUN_API_KEY = "";
      process.env.MAILGUN_DOMAIN = "";
      const result = await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT);
      expect(result).toEqual({ ok: false, error: "mailgun_not_configured" });
    });

    it("returns network_error on fetch failure", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      vi.stubGlobal("fetch", () => { throw new Error("Network error"); });

      const result = await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT);
      expect(result).toEqual({ ok: false, error: "network_error" });
    });

    it("returns mailgun_domain_not_found for 404 responses", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      vi.stubGlobal("fetch", () =>
        Promise.resolve(mockFetchResponse(404, '{"message": "Domain not found"}'))
      );

      const result = await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT);
      expect(result).toEqual({
        ok: false,
        error: "mailgun_domain_not_found",
        messageId: '{"message": "Domain not found"}',
      });
    });

    it("returns http_500 for 500 responses", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      vi.stubGlobal("fetch", () =>
        Promise.resolve(mockFetchResponse(500, '{"message": "Internal server error"}'))
      );

      const result = await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT);
      expect(result).toEqual({
        ok: false,
        error: "http_500",
        messageId: '{"message": "Internal server error"}',
      });
    });

    it("returns success on 200 response", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      vi.stubGlobal("fetch", () =>
        Promise.resolve(mockFetchResponse(200, '{"id": "<test@test.example.com>"}'))
      );

      const result = await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT, VALID_HTML);
      expect(result).toEqual({
        ok: true,
        messageId: "<test@test.example.com>",
      });
    });

    it("includes HTML body when provided", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      const fetchMock = vi.fn<
        (url: string, init?: RequestInit) => Promise<Response>
      >(async () => mockFetchResponse(200, '{"id": "<test@test.example.com>"}'));
      vi.stubGlobal("fetch", fetchMock);

      await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT, VALID_HTML);

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];
      const body = new URLSearchParams(options?.body as string);
      expect(url).toContain("/test.example.com/messages");
      expect(body.get("html")).toBe(VALID_HTML);
    });

    it("excludes HTML body when not provided", async () => {
      process.env.MAILGUN_API_KEY = "test-key";
      process.env.MAILGUN_DOMAIN = "test.example.com";
      const fetchMock = vi.fn<
        (url: string, init?: RequestInit) => Promise<Response>
      >(async () => mockFetchResponse(200, '{"id": "<test@test.example.com>"}'));
      vi.stubGlobal("fetch", fetchMock);

      await sendMail(VALID_TO, VALID_SUBJECT, VALID_TEXT);

      expect(fetchMock).toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0];
      const body = new URLSearchParams(options?.body as string);
      expect(url).toContain("/test.example.com/messages");
      expect(body.get("html")).toBeNull();
    });
  });
});