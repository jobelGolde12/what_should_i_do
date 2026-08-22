import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import {
  extractMarkdown,
  FLASH_MAX_BYTES,
  PRECISION_MAX_BYTES,
  MineruUnsupportedError,
  MineruLimitError,
  MineruTimeoutError,
} from "@/lib/mineru";
import { logRequest } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Document → Markdown preprocessing for the analysis composer.
 *
 * Supported files (PDF/images/DOCX/PPTX/XLSX/HTML) are converted with the
 * MinerU Open SDK before any AI interaction. `.txt` and unknown types return
 * 415 so the client falls back to its existing extraction flow unchanged.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId =
    request.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const userId = await getCurrentUserId();
  // Anonymous users get a tighter per-IP budget; signed-in users a per-user one.
  const rl = rateLimit(userId ? `user:${userId}` : getClientIp(request), userId ? 30 : 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many conversion requests. Try again in a minute." },
      { status: 429 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const raw = form.get("file");
    if (raw instanceof File) file = raw;
  } catch {
    /* handled below */
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const hasToken = Boolean(process.env.MINERU_TOKEN);
  const maxBytes = hasToken ? PRECISION_MAX_BYTES : FLASH_MAX_BYTES;

  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: hasToken
          ? "File is larger than the 200 MB conversion limit."
          : `File is over the 10 MB fast-conversion limit. Set MINERU_TOKEN for files up to 200 MB.`,
      },
      { status: 413 }
    );
  }

  logRequest(requestId, "mineru-extract", {
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
  });

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await extractMarkdown({
      buffer,
      fileName: file.name,
      mimeType: file.type,
    });

    logRequest(requestId, "mineru-extract", {
      fileName: file.name,
      engine: result.engine,
      markdownChars: result.markdown.length,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      markdown: result.markdown,
      engine: result.engine,
      originalBytes: file.size,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document conversion failed.";

    logRequest(requestId, "mineru-extract", {
      fileName: file.name,
      error: message,
      latencyMs: Date.now() - startedAt,
    });

    if (error instanceof MineruUnsupportedError) {
      return NextResponse.json({ error: message }, { status: 415 });
    }
    if (error instanceof MineruLimitError) {
      return NextResponse.json({ error: message }, { status: 413 });
    }
    if (error instanceof MineruTimeoutError) {
      return NextResponse.json({ error: message }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
