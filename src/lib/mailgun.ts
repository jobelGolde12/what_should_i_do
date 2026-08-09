/**
 * Minimal Mailgun Messages API client. Uses the native `fetch` API — no new
 * dependencies. Only server-side (the API key must never be exposed to the
 * browser).
 *
 * Env (all server-only):
 *   MAILGUN_API_KEY     private API key  (required)
 *   MAILGUN_DOMAIN      verified sending domain, e.g. mg.example.com (required)
 *   MAILGUN_FROM        override From address (optional)
 *   MAILGUN_BASE_URL    API base incl /v3 (optional, default https://api.mailgun.net/v3)
 */
import { logWarn } from "@/lib/log";

export type MailResult = {
  ok: boolean;
  error?: string;
  messageId?: string;
};

const DEFAULT_BASE = "https://api.mailgun.net/v3";

/** `true` when both the API key and domain are configured. */
export function isMailgunConfigured(): boolean {
  return Boolean(process.env.MAILGUN_API_KEY) && Boolean(process.env.MAILGUN_DOMAIN);
}

/** Resolves the From address, defaulting to `no-reply@<domain>`. */
export function mailgunFrom(): string {
  const from = process.env.MAILGUN_FROM?.trim();
  if (from) return from;
  const domain = process.env.MAILGUN_DOMAIN?.trim() || "";
  return domain ? `no-reply@${domain}` : "no-reply@taskmind.app";
}

function mailgunEndpoint(): string | null {
  if (!isMailgunConfigured()) return null;
  const base = (process.env.MAILGUN_BASE_URL || DEFAULT_BASE).trim();
  const domain = process.env.MAILGUN_DOMAIN!.trim();
  return `${base}/${domain}/messages`;
}

/** Builds an absolute app URL for email links (verification / password reset). */
export function buildAppUrl(path: string): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "https://taskmind.app").trim();
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Sends a message via the Mailgun Messages API. Returns a result object rather
 * than throwing so callers can degrade gracefully (e.g. dev without Mailgun).
 */
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<MailResult> {
  const endpoint = mailgunEndpoint();
  if (!endpoint) {
    return { ok: false, error: "mailgun_not_configured" };
  }

  const user = "api";
  const pass = process.env.MAILGUN_API_KEY!;
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");

  const body = new URLSearchParams();
  body.set("from", mailgunFrom());
  body.set("to", to);
  body.set("subject", subject);
  body.set("text", text);
  if (html) body.set("html", html);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    logWarn("mail", { error: message, to });
    return { ok: false, error: "network_error" };
  }

  if (!res.ok) {
    const detail = await res
      .text()
      .catch(() => "")
      .then((t) => t.slice(0, 300));
    logWarn("mail", { status: res.status, detail, to });
    return { ok: false, error: `http_${res.status}`, messageId: detail || undefined };
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  return { ok: true, messageId: data?.id ?? data?.message };
}
