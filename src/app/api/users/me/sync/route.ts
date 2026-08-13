import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import {
  applySyncChanges,
  getSyncChanges,
  isSyncChange,
  MAX_SYNC_ROWS,
  type SyncChange,
} from "@/lib/auth/users";
import { proGate } from "@/lib/pro/entitlements";
import { logSyncEvent } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SYNC_BODY = 4_000_000;

type SyncBody = { since?: unknown; push?: unknown };

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const size = JSON.stringify(body).length;
  if (size > MAX_SYNC_BODY) {
    logSyncEvent("sync_error", { userId, reason: "payload_too_large", size });
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const since =
    typeof body.since === "number" && Number.isFinite(body.since) && body.since >= 0
      ? body.since
      : 0;

  const push: SyncChange[] = [];
  if (Array.isArray(body.push) && body.push.length > 0) {
    if (body.push.length > MAX_SYNC_ROWS) {
      logSyncEvent("sync_error", { userId, reason: "too_many_changes" });
      return NextResponse.json(
        { error: "Too many changes in one sync." },
        { status: 413 }
      );
    }
    for (const item of body.push) {
      if (!isSyncChange(item)) {
        logSyncEvent("sync_error", { userId, reason: "invalid_change" });
        return NextResponse.json(
          { error: "Invalid change in sync payload." },
          { status: 400 }
        );
      }
      push.push(item);
    }
  }

  const rejected = push.length
    ? await applySyncChanges(userId, push)
    : [];

  const changes = await getSyncChanges(userId, since);
  const seen = new Set(changes.map((c) => `${c.collection}:${c.id}`));
  for (const r of rejected) {
    const key = `${r.collection}:${r.id}`;
    if (!seen.has(key)) {
      changes.push(r);
      seen.add(key);
    }
  }

  logSyncEvent("sync_push", {
    userId,
    since,
    pushed: push.length,
    rejected: rejected.length,
    returned: changes.length,
  });

  return NextResponse.json({ changes, now: Date.now() });
}
