/**
 * Sentry instrumentation for Next.js.
 * 
 * This file is automatically loaded by Next.js to initialize Sentry
 * on the server side. It's used for performance monitoring and error tracking.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and initialize Sentry for Node.js runtime
    await import("@/lib/sentry");
  }
}
