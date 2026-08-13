// Minimal structured logger. Never logs the analyzed text itself — only
// metadata (request id, endpoint, byte counts, latency). Keep it dependency-free.
// Auth & sync events are logged here too (no raw text/PII).

type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, string | number | boolean | null | undefined>;

function emit(level: LogLevel, scope: string, meta: LogMeta) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, scope, ...meta });
  if (level === "warn") {
    console.warn(`[taskmind] ${line}`);
  } else if (level === "error") {
    console.error(`[taskmind] ${line}`);
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
  emit("error", "error", { requestId, endpoint, message });
}

export function logInfo(scope: string, meta: LogMeta = {}) {
  emit("info", scope, meta);
}

export function logWarn(scope: string, meta: LogMeta = {}) {
  emit("warn", scope, meta);
}

type AuthEvent =
  | "register"
  | "register_verified"
  | "login"
  | "login_blocked"
  | "verify"
  | "verify_failed"
  | "resend_verification"
  | "forgot_password"
  | "reset_password"
  | "logout";

/** Auth-domain audit event (registration, verification, login, reset, etc.).
 * Never include raw text, passwords, or full tokens — only event metadata. */
export function logAuthEvent(event: AuthEvent, meta: LogMeta = {}) {
  emit("info", "auth", { event, ...meta });
}

type SyncEvent = "sync_push" | "sync_pull" | "sync_patch" | "sync_error";

/** Sync-domain audit event. Never include the raw analyzed text. */
export function logSyncEvent(event: SyncEvent, meta: LogMeta = {}) {
  emit("info", "sync", { event, ...meta });
}


