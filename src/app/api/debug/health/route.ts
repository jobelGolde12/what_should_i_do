import { NextResponse } from "next/server";
import { openRouterAPI } from "@/lib/openrouter";

export const runtime = "nodejs";

export async function GET() {
  const keys = openRouterAPI.getKeyStatuses();
  const healthy = keys.some((k) => k.isWorking);
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: Date.now(),
      openrouter: {
        configured: keys.length > 0,
        keyCount: keys.length,
        healthyKeys: keys.filter((k) => k.isWorking).length,
        statuses: keys,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
