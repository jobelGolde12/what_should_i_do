"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDialog?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that captures errors and sends them to Sentry.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send error to Sentry
    Sentry.withScope((scope) => {
      scope.setTag("component", "ErrorBoundary");
      scope.setExtras({
        componentStack: errorInfo.componentStack,
      });
      Sentry.captureException(error);
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-line bg-surface-2 p-6">
          <div className="text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h3 className="mb-2 text-lg font-semibold text-ink">
              Something went wrong
            </h3>
            <p className="mb-4 text-sm text-muted">
              An unexpected error occurred. The issue has been reported to our
              team.
            </p>
            <button
              onClick={this.handleReset}
              className="rounded-md bg-night px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-night/90"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version of ErrorBoundary for functional components.
 * 
 * Usage:
 * ```tsx
 * const { errorBoundaryProps } = useErrorBoundary();
 * return <ErrorBoundary {...errorBoundaryProps}><YourComponent /></ErrorBoundary>;
 * ```
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((err: Error) => {
    setError(err);
    Sentry.captureException(err);
  }, []);

  return {
    error,
    resetError,
    captureError,
    errorBoundaryProps: {
      children: null as React.ReactNode,
      fallback: error ? (
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-sm text-high">
            Error: {error.message}
          </p>
          <button
            onClick={resetError}
            className="mt-2 text-sm text-muted underline hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      ) : undefined,
    },
  };
}
