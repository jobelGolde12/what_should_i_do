import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { updateUserData, deleteUser } from "@/lib/auth/users";

export const runtime = "nodejs";

function publicUser(user: { id: string; email: string; createdAt: number }) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({
    user: publicUser(user),
    data: user.data,
  });
}

type SyncBody = { history?: unknown[]; templates?: unknown[]; board?: unknown[] };

export async function PUT(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const size = JSON.stringify(body).length;
  if (size > 2_000_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const next = {
    history: Array.isArray(body.history) ? body.history : user.data.history,
    templates: Array.isArray(body.templates) ? body.templates : user.data.templates,
    board: Array.isArray(body.board) ? body.board : user.data.board,
  };
  const updated = updateUserData(user.id, next);
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({
    user: publicUser(updated),
    data: updated.data,
  });
}

export async function DELETE() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  deleteUser(user.id);
  return NextResponse.json({ ok: true });
}
