"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  children: ReactNode;
  /** Optional label for the segment (e.g. "History"). */
  segment?: string;
};

type State = {
  error: Error | null;
};

/**
 * Route-level error boundary with skeleton-compatible structural language
 * (header slot + muted messaging). Catches data/render failures for a segment.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RouteErrorBoundary${this.props.segment ? `:${this.props.segment}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 border-b border-line pb-8">
            <p className="font-mono text-2xs uppercase tracking-label-wide text-accent">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink">
              Something went wrong
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              {this.props.segment
                ? `This ${this.props.segment} view hit an error.`
                : "This view hit an error."}{" "}
              The rest of the app is still available.
            </p>
          </header>
          <div
            role="alert"
            className="border border-high/40 bg-high-bg px-6 py-8"
          >
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-high" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Couldn&rsquo;t load this page.
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {this.state.error.message || "An unexpected error occurred."}
                </p>
                <Button
                  variant="dark"
                  size="sm"
                  className="mt-4"
                  onClick={() => this.setState({ error: null })}
                >
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
