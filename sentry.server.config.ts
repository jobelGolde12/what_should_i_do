import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console
  // while setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Release tag
  release: process.env.npm_package_version,

  // Prevent sending PII to Sentry
  beforeSend(event) {
    // Strip any sensitive data from the event
    if (event.request?.data && typeof event.request.data === "object") {
      // Don't send the analyzed text content
      const data = event.request.data as Record<string, unknown>;
      delete data.text;
      delete data.content;
    }
    
    // Strip cookies and headers that might contain sensitive info
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    
    return event;
  },

  // Enable Spotlight in development for better debugging
  spotlight: process.env.NODE_ENV === "development",
});
