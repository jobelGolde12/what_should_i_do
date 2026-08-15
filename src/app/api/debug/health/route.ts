import { NextResponse } from "next/server";
import { aiClient } from "@/lib/ai";
import { isDebugAllowed, authorized, DEBUG_UNAVAILABLE } from "@/lib/debug/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDebugAllowed()) {
    return NextResponse.json(DEBUG_UNAVAILABLE, { status: 404 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const diagnostics = aiClient.getDiagnostics();
  const healthy = diagnostics.configured;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: Date.now(),
      ai: {
        provider: diagnostics.provider,
        configured: diagnostics.configured,
        model: diagnostics.model,
        fallbackModels: diagnostics.fallbackModels,
        autoRoute: diagnostics.autoRoute,
        promptVersion: diagnostics.promptVersion,
        circuitBreaker: diagnostics.circuitBreaker,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
