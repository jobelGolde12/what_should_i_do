// Minimal structured logger. Never logs the analyzed text itself — only
// metadata (request id, endpoint, byte counts, latency). Keep it dependency-free.

type LogMeta = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn", scope: string, meta: LogMeta) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, scope, ...meta });
  if (level === "warn") {
    console.warn(`[taskmind] ${line}`);
  } else {
    console.log(`[taskmind] ${line}`);
  }
}

export function logRequest(
  requestId: string,
  endpoint: string,
  meta: LogMeta = {}
) {
  emit("info", "request", { requestId, endpoint, ...meta });
}

export function logError(requestId: string, endpoint: string, message: string) {
  emit("warn", "error", { requestId, endpoint, message });
}
