"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace]", error);
  }, [error]);

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
          This page failed to load. Your data on this device is still intact.
        </p>
      </header>
      <div role="alert" className="border border-high/40 bg-high-bg px-6 py-8">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-high" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Couldn&rsquo;t load this page.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {error.message || "An unexpected error occurred."}
            </p>
            <Button variant="dark" size="sm" className="mt-4" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
