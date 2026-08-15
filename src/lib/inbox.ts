/**
 * Inbox message store (Pro). Tracks messages that arrived via the Mailgun
 * forward address, together with whether each has been analyzed (and its
 * analysis id).
 */
import { getDb, ensureSchema } from "@/lib/db";

export type InboxProvider = "forward";

export type InboxMessage = {
  id: string;
  userId: string;
  provider: InboxProvider;
  externalId: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  body: string;
  analysisId: string;
  analyzed: boolean;
  replied: boolean;
  createdAt: number;
};

async function db() {
  await ensureSchema();
  return getDb();
}

export type InboxMessageInput = Omit<
  InboxMessage,
  "userId" | "createdAt" | "replied"
> & { replied?: boolean };

function rowToInbox(row: Record<string, unknown>): InboxMessage {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    provider: row.provider as InboxProvider,
    externalId: (row.external_id as string) ?? "",
    sender: (row.sender as string) ?? "",
    subject: (row.subject as string) ?? "",
    snippet: (row.snippet as string) ?? "",
    receivedAt: Number(row.received_at),
    body: (row.body as string) ?? "",
    analysisId: (row.analysis_id as string) ?? "",
    analyzed: Number(row.analyzed) === 1,
    replied: Number(row.replied) === 1,
    createdAt: Number(row.created_at),
  };
}

/** Inserts or updates a message in the inbox (deduped by id). */
export async function saveInboxMessage(
  userId: string,
  msg: InboxMessageInput
): Promise<void> {
  const database = await db();
  await database.execute(
    "INSERT INTO inbox_messages(id, user_id, provider, external_id, sender, subject, snippet, received_at, body, analysis_id, analyzed, replied, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET " +
      "provider = excluded.provider, external_id = excluded.external_id, sender = excluded.sender, subject = excluded.subject, " +
      "snippet = excluded.snippet, received_at = excluded.received_at, body = excluded.body, " +
      "analysis_id = excluded.analysis_id, analyzed = excluded.analyzed, replied = excluded.replied",
    [
      msg.id,
      userId,
      msg.provider,
      msg.externalId,
      msg.sender,
      msg.subject,
      msg.snippet,
      msg.receivedAt,
      msg.body,
      msg.analysisId,
      msg.analyzed ? 1 : 0,
      msg.replied ? 1 : 0,
      Date.now(),
    ]
  );
}

export async function markInboxAnalyzed(
  userId: string,
  id: string,
  analysisId: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE inbox_messages SET analyzed = 1, analysis_id = ? WHERE user_id = ? AND id = ?",
    [analysisId, userId, id]
  );
}

export async function markInboxReplied(
  userId: string,
  id: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE inbox_messages SET replied = 1 WHERE user_id = ? AND id = ?",
    [userId, id]
  );
}

export async function getInboxMessages(
  userId: string,
  limit = 50
): Promise<InboxMessage[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM inbox_messages WHERE user_id = ? ORDER BY received_at DESC LIMIT ?",
    [userId, Math.max(1, Math.min(limit, 200))]
  );
  return (res.rows ?? []).map((r) => rowToInbox(r as Record<string, unknown>));
}

export async function getInboxMessageById(
  userId: string,
  id: string
): Promise<InboxMessage | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM inbox_messages WHERE user_id = ? AND id = ?",
    [userId, id]
  );
  if (!res.rows?.length) return null;
  return rowToInbox(res.rows[0] as Record<string, unknown>);
}

/** The inbox row tied to an analysis (used to derive reply To/Subject). */
export async function getInboxByAnalysisId(
  userId: string,
  analysisId: string
): Promise<InboxMessage | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM inbox_messages WHERE user_id = ? AND analysis_id = ? LIMIT 1",
    [userId, analysisId]
  );
  if (!res.rows?.length) return null;
  return rowToInbox(res.rows[0] as Record<string, unknown>);
}

export async function deleteInboxMessagesForAnalysis(
  userId: string,
  analysisId: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "DELETE FROM inbox_messages WHERE user_id = ? AND analysis_id = ?",
    [userId, analysisId]
  );
}
