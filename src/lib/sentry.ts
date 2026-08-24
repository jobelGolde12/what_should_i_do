/**
 * Sentry utility functions for custom error tracking and performance monitoring.
 * 
 * This module provides helpers for:
 * - Capturing custom errors with context
 * - Adding breadcrumbs for debugging
 * - Performance monitoring (transactions)
 * - User context for debugging
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error with additional context.
 * 
 * @param error - The error to capture
 * @param context - Additional context to attach
 * @param level - Severity level (default: "error")
 */
export function captureError(
  error: Error | unknown,
  context: Record<string, unknown> = {},
  level: Sentry.SeverityLevel = "error"
): void {
  Sentry.withScope((scope) => {
    // Set severity level
    scope.setLevel(level);

    // Add context data
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }

    // Capture the error
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with context (for non-error events).
 * 
 * @param message - The message to capture
 * @param context - Additional context
 * @param level - Severity level (default: "info")
 */
export function captureMessage(
  message: string,
  context: Record<string, unknown> = {},
  level: Sentry.SeverityLevel = "info"
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(level);

    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }

    Sentry.captureMessage(message);
  });
}

/**
 * Add a breadcrumb for debugging.
 * 
 * @param category - Breadcrumb category (e.g., "auth", "ui", "api")
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data: Record<string, unknown> = {}
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: "info",
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for debugging (without PII).
 * 
 * @param userId - User ID (hashed or anonymized)
 * @param plan - User's plan tier
 */
export function setUserContext(
  userId: string,
  plan?: string
): void {
  Sentry.setUser({
    id: userId,
    // Don't set email or other PII
  });

  if (plan) {
    Sentry.setTag("user.plan", plan);
  }
}

/**
 * Clear user context (e.g., on logout).
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Capture a performance span using Sentry's current span API.
 * 
 * @param name - Span name
 * @param operation - Operation type (e.g., "http", "db", "ai")
 * @param callback - Function to execute and measure
 * @returns Result of the callback
 */
export async function measureSpan<T>(
  name: string,
  operation: string,
  callback: () => Promise<T>
): Promise<T> {
  const span = Sentry.startSpan(
    {
      name,
      op: operation,
    },
    async (s) => {
      try {
        const result = await callback();
        s?.setStatus({ code: 0, message: "ok" });
        return result;
      } catch (error) {
        s?.setStatus({ code: 2, message: "internal_error" });
        throw error;
      }
    }
  );
  return span;
}

/**
 * Set tags for the current scope.
 * 
 * @param tags - Tags to set
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) {
      scope.setTag(key, value);
    }
  });
}

/**
 * Capture an AI provider error with context.
 * 
 * @param provider - Provider name (tokenrouter, openrouter, zen)
 * @param error - The error that occurred
 * @param requestId - Request ID for correlation
 */
export function captureAIError(
  provider: string,
  error: Error | unknown,
  requestId?: string
): void {
  captureError(error, {
    provider,
    requestId,
    category: "ai-provider",
  });
}

/**
 * Capture a rate limit event.
 * 
 * @param ip - Client IP (hashed)
 * @param endpoint - Endpoint that was rate limited
 * @param limit - Rate limit that was exceeded
 */
export function captureRateLimit(
  ip: string,
  endpoint: string,
  limit: number
): void {
  captureMessage(
    `Rate limit exceeded: ${endpoint}`,
    {
      ip: hashIP(ip),
      endpoint,
      limit,
      category: "rate-limit",
    },
    "warning"
  );
}

/**
 * Hash an IP address for logging (non-reversible).
 * 
 * @param ip - IP address to hash
 * @returns Hashed IP
 */
function hashIP(ip: string): string {
  // Simple hash for logging purposes
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `ip_${Math.abs(hash).toString(16)}`;
}
