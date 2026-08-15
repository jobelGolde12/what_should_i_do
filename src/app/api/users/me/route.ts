import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { updateUserData, deleteUser } from "@/lib/auth/users";
import { validateSyncBatch } from "@/lib/auth/validation";
import { logSyncEvent } from "@/lib/log";

export const runtime = "nodejs";

function publicUser(user: { id: string; email: string; createdAt: number; verified: boolean }) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    emailVerified: user.verified,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  logSyncEvent("sync_pull", { userId: user.id });
  return NextResponse.json({
    user: publicUser(user),
    data: user.data,
  });
}

type SyncBody = { history?: unknown[]; templates?: unknown[]; board?: unknown[] };

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const size = JSON.stringify(body).length;
  if (size > 2_000_000) {
    logSyncEvent("sync_error", { userId: user.id, reason: "payload_too_large", size });
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  // Strict whitelist validation: every record must match its schema. Any
  // malformed record rejects the whole batch (all-or-nothing).
  const result = validateSyncBatch(body);
  if (!result.ok) {
    logSyncEvent("sync_error", {
      userId: user.id,
      reason: result.reason,
      invalid: result.invalid,
      size,
    });
    return NextResponse.json(
      { error: "Invalid records in the sync payload." },
      { status: 400 }
    );
  }

  // Collections not present in the body keep their existing server state.
  const next = {
    history: body.history !== undefined ? result.next.history : user.data.history,
    templates:
      body.templates !== undefined ? result.next.templates : user.data.templates,
    board: body.board !== undefined ? result.next.board : user.data.board,
  };
  const updated = await updateUserData(user.id, next);
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  logSyncEvent("sync_push", { userId: user.id, size });
  return NextResponse.json({
    user: publicUser(updated),
    data: updated.data,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await deleteUser(user.id);
  logSyncEvent("sync_patch", { userId: user.id, action: "delete_user" });
  return NextResponse.json({ ok: true });
}
