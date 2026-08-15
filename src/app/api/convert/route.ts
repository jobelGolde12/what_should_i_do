import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { rateLimit } from "@/lib/rateLimit";
import { proGate, limitsForUser, planForUser } from "@/lib/pro/entitlements";
import { tryIncrement, limitReached, monthWindow } from "@/lib/pro/usage";
import { convertFile, type ConvertFormat } from "@/lib/convert";
import { logRequest } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONVERT_TIMEOUT_MS = 60_000;

function isConvertFormat(value: unknown): value is ConvertFormat {
  return value === "pdf" || value === "docx" || value === "txt";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(user.id);
  if (denied) return denied;

  const rl = rateLimit(`user:${user.id}`, 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many conversion requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const limits = await limitsForUser(user.id);

  let target: ConvertFormat | null = null;
  let file: File | null = null;
  try {
    const form = await request.formData();
    const rawTarget = form.get("target");
    if (isConvertFormat(rawTarget)) target = rawTarget;
    const rawFile = form.get("file");
    if (rawFile instanceof File) file = rawFile;
  } catch {
    /* handled below */
  }

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json(
      { error: "Choose a target format (pdf, docx, or txt)." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > limits.maxFileBytes) {
    return NextResponse.json(
      { error: `File must be at most ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  const allowed = await tryIncrement(
    user.id,
    "conversions",
    limits.conversionsPerMonth,
    monthWindow()
  );
  if (!allowed) return limitReached("conversions");

  const startedAt = Date.now();
  const requestId =
    request.headers.get("x-request-id") ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  logRequest(requestId, "convert", {
    fileName: file.name,
    size: file.size,
    target,
    plan: await planForUser(user.id),
  });

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await withTimeout(
      convertFile({
        buffer,
        fileName: file.name,
        mimeType: file.type,
        target,
      }),
      CONVERT_TIMEOUT_MS
    );

    logRequest(requestId, "convert", {
      fileName: file.name,
      target,
      latencyMs: Date.now() - startedAt,
    });

    const safeName = result.fileName.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");
    return new Response(Buffer.from(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed.";
    logRequest(requestId, "convert", {
      fileName: file.name,
      target,
      error: message,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: message },
      { status: 422 }
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Conversion timed out. Try a smaller file.")),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
