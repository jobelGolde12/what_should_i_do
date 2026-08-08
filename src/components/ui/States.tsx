import { FileText, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  title = "Paste or upload something to analyze",
  hint = "Drop a message, email, announcement, or document. TaskMind will turn it into actions, deadlines, and a next step.",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line bg-surface px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center border border-line bg-background">
        <FileText className="h-5 w-5 text-muted" />
      </span>
      <h2 className="mt-4 font-display text-lg font-medium text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {hint}
      </p>
    </div>
  );
}

export function LoadingState({
  label = "Turning noise into clarity…",
}: {
  label?: string;
}) {
  return (
    <div className="border border-line bg-surface px-6 py-14">
      <div className="mx-auto max-w-sm text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-accent" />
        <p className="mt-4 font-mono text-sm tracking-wide text-ink">
          {label}
        </p>
        <p className="mt-2 text-xs text-muted">
          Extracting actions, deadlines, and urgency.
        </p>
        <div className="loading-bar mt-6" aria-hidden="true" />
      </div>
    </div>
  );
}

export function ErrorState({
  reason,
  onRetry,
}: {
  reason: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border border-high/40 bg-high-bg px-6 py-8"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-high" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Couldn&rsquo;t analyze that.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {reason}
          </p>
          {onRetry && (
            <Button
              variant="dark"
              size="sm"
              onClick={onRetry}
              className="mt-4"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
