import { NextResponse } from "next/server";
import { aiClient } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
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
