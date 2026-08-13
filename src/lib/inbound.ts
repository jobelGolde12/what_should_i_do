/**
 * Forward-to-TaskMind inbound engine (Pro).
 *
 * Pro users get a private `{slug}@<domain>` address (Mailgun receive route).
 * Emails forwarded there are signature-verified, rate-limited, then analyzed
 * and saved to the user's history + inbox.
 *
 * Signing key: `MAILGUN_WEBHOOK_SIGNING_KEY` (falls back to `MAILGUN_API_KEY`).
 * Signature = HMAC-SHA256(key, `<timestamp><token>`) hex, and the timestamp is
 * checked against a freshness window to block replays.
 */
import { createHmac, createHash } from "crypto";
import { getDb, ensureSchema } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { analyzeText, type AnalysisResult } from "@/app/actions/analyzeText";
import { uid } from "@/lib/storage";
import { upsertAnalysis, findUserById } from "@/lib/auth/users";
import { saveInboxMessage, type InboxProvider } from "@/lib/inbox";
import { mailgunFrom } from "@/lib/mailgun";
import type { AnalysisRecord } from "@/lib/types";

export const INBOUND_DOMAIN_DEFAULT = "in.taskmind.app";
export const INBOUND_RATE_LIMIT = 60;
export const INBOUND_WINDOW_MS = 60 * 60 * 1000;
export const SIGNATURE_MAX_AGE_MS = 15 * 60 * 1000;

export function inboundDomain(): string {
  return (process.env.INBOUND_DOMAIN || INBOUND_DOMAIN_DEFAULT).trim();
}

/** Stable per-user slug (from the user id) — the local part of the address. */
export function deriveInboundSlug(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 10);
}

export function inboundAddress(slug: string): string {
  return `${slug}@${inboundDomain()}`;
}

export async function ensureInboundRoute(userId: string): Promise<string> {
  const database = await db();
  const slug = deriveInboundSlug(userId);
  await database.execute(
    "INSERT OR IGNORE INTO inbound_routes(slug, user_id, active, created_at) VALUES (?, ?, 1, ?)",
    [slug, userId, Date.now()]
  );
  return slug;
}

export async function findUserIdByInboundSlug(
  slug: string
): Promise<string | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT user_id FROM inbound_routes WHERE slug = ? AND active = 1",
    [slug]
  );
  if (!res.rows?.length) return null;
  return res.rows[0].user_id as string;
}

/* =========================================================
   Mailgun signature verification
   ========================================================= */

export function verifyMailgunSignature(
  form: Record<string, string | undefined>,
  opts: {
    key?: string;
    now?: number;
    maxAgeMs?: number;
  } = {}
): boolean {
  const token = form.token ?? "";
  const timestamp = form.timestamp ?? "";
  const signature = form.signature ?? "";
  if (!token || !timestamp || !signature) return false;

  const now = opts.now ?? Date.now();
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs)) return false;
  if (now - tsMs > (opts.maxAgeMs ?? SIGNATURE_MAX_AGE_MS)) return false;

  const key =
    opts.key ??
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY ??
    process.env.MAILGUN_API_KEY ??
    "";
  if (!key) return false;

  const expected = createHmac("sha256", key)
    .update(`${timestamp}${token}`)
    .digest("hex");
  return signature === expected;
}

/* =========================================================
   Message parsing
   ========================================================= */

export type InboundMessage = {
  slug: string | null;
  sender: string;
  subject: string;
  body: string;
  messageId: string | null;
};

export function parseInboundMessage(
  form: Record<string, string | undefined>
): InboundMessage {
  const recipient = (form.recipient ?? "").trim();
  const slug = recipient.split("@")[0] || null;
  const body = (form["stripped-text"] || form["body-plain"] || "").trim();
  return {
    slug,
    sender: (form.from || form.sender || "").trim(),
    subject: (form.subject || "").trim(),
    body,
    messageId: form["Message-Id"] ?? null,
  };
}

/** Parses the `message-headers` JSON blob Mailgun attaches. */
export function parseMessageHeaders(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as [string, string][];
    for (const [name, value] of parsed) {
      out[name.toLowerCase()] = value;
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** True for auto-generated / auto-replied messages (loop protection). */
export function isAutoReply(headers: Record<string, string>): boolean {
  const auto = (headers["auto-submitted"] || "").toLowerCase();
  if (auto && auto !== "no") return true;
  const precedence = (headers["precedence"] || "").toLowerCase();
  if (precedence === "bulk" || precedence === "auto_reply" || precedence === "junk") {
    return true;
  }
  return Boolean(headers["x-autoreply"]) || Boolean(headers["x-auto-response-suppress"]);
}

/** True when the sender is one of our own transactional addresses. */
export function isTransactionalSender(sender: string): boolean {
  const lower = sender.toLowerCase();
  const from = mailgunFrom().toLowerCase();
  if (from && lower === from) return true;
  const bracket = lower.match(/<([^>]+)>/)?.[1] ?? lower.trim();
  return (
    bracket.startsWith("no-reply@") || bracket.startsWith("notifications@")
  );
}

/* =========================================================
   Analyze + persist
   ========================================================= */

export type InboundAnalyzer = (input: string) => Promise<AnalysisResult>;

export type IncomingEmail = {
  sender: string;
  subject: string;
  body: string;
  externalId?: string;
};

/**
 * Core analyze-and-persist for any incoming email (forwarded or from a
 * connected provider). Saves to history (via `upsertAnalysis`) + inbox, and
 * returns the created analysis record or `null` when the message is too short
 * or the analyzer fails. `analyzer` is injectable for tests.
 */
export async function analyzeEmail(
  userId: string,
  msg: IncomingEmail,
  opts: {
    provider: InboxProvider;
    analyzer?: InboundAnalyzer;
    receivedAt?: number;
  } = {
    provider: "forward",
  }
): Promise<AnalysisRecord | null> {
  const text = [msg.subject, msg.body].filter(Boolean).join("\n\n").trim();
  if (text.length < 10) return null;
  const analyzer = opts.analyzer ?? ((input) => analyzeText(input));
  const result = await analyzer(text).catch(() => null);
  if (!result) return null;

  const record: AnalysisRecord = {
    id: uid(),
    timestamp: Date.now(),
    input: text,
    output: result,
    sourceLabel: msg.sender ? `Email: ${msg.sender}` : "Email",
  };
  await upsertAnalysis(userId, record);
  await saveInboxMessage(userId, {
    id: record.id,
    provider: opts.provider,
    externalId: msg.externalId ?? "",
    sender: msg.sender,
    subject: msg.subject,
    snippet: text.slice(0, 300),
    receivedAt: opts.receivedAt ?? Date.now(),
    body: text,
    analysisId: record.id,
    analyzed: true,
  });
  return record;
}

/**
 * Analyzes a forwarded email (forward-to-TaskMind address) and saves it to
 * history + inbox. Thin wrapper over `analyzeEmail` for the inbound route.
 */
export async function analyzeInboundEmail(
  userId: string,
  msg: InboundMessage,
  analyzer: InboundAnalyzer = (input) => analyzeText(input)
): Promise<AnalysisRecord | null> {
  return analyzeEmail(
    userId,
    {
      sender: msg.sender,
      subject: msg.subject,
      body: msg.body,
      externalId: msg.messageId ?? undefined,
    },
    { provider: "forward", analyzer }
  );
}

async function db() {
  await ensureSchema();
  return getDb();
}

/** Rate-limit helper shared by the inbound route. */
export function inboundRateLimited(slug: string): boolean {
  return !rateLimit(`inbound:${slug}`, INBOUND_RATE_LIMIT, INBOUND_WINDOW_MS).allowed;
}

/** Looks up the user owning a slug (with email for self-loop checks). */
export async function inboundUser(slug: string): Promise<{ id: string; email: string } | null> {
  const userId = await findUserIdByInboundSlug(slug);
  if (!userId) return null;
  const user = await findUserById(userId);
  if (!user) return null;
  return { id: user.id, email: user.email };
}
