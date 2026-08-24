import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console
  // while setting up Sentry.
  debug: false,

  // replaysSessionSampleRate and replaysOnErrorSampleRate are defined so that
  // sample rates are chosen based on the environment.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

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

  // Set environment tag
  environment: process.env.NODE_ENV || "development",

  // Set release tag
  release: process.env.npm_package_version,
});
