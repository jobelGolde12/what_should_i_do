import { NextResponse } from "next/server";
import { analyzeText } from "@/app/actions/analyzeText";
import { isDebugAllowed, authorized, DEBUG_UNAVAILABLE } from "@/lib/debug/guard";

export const runtime = "nodejs";

const SAMPLE_INPUT = "Suspend classes today due to heavy rainfall";

type DebugBody = { input?: unknown };

export async function POST(request: Request) {
  if (!isDebugAllowed()) {
    return NextResponse.json(DEBUG_UNAVAILABLE, { status: 404 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let input = SAMPLE_INPUT;
  try {
    const body = (await request.json()) as DebugBody;
    if (typeof body.input === "string" && body.input.trim()) {
      input = body.input.slice(0, 20_000);
    }
  } catch {
    /* keep the sample input */
  }

  const started = Date.now();
  try {
    const result = await analyzeText(input);
    return NextResponse.json({
      success: true,
      input,
      result,
      latencyMs: Date.now() - started,
      analysisMethod: result.analysisMethod ?? "unknown",
    });
  } catch (error) {
    console.error("Server action test error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        input,
        error: errorMessage,
        stack: errorStack,
        latencyMs: Date.now() - started,
      },
      { status: 500 }
    );
  }
}
