import React from "react";
import { LoaderCircle, TriangleAlert, Upload, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title?: string;
  hint?: string;
  onUpload?: () => void;
  tags?: string[];
  className?: string;
}

export function EmptyState({
  title = "Paste or upload something to analyze",
  hint = "Drop a message, email, announcement, or document. TaskMind will turn it into actions, deadlines, and a next step.",
  onUpload,
  tags = [],
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`group relative flex flex-col items-center justify-center overflow-hidden p-8 text-center ${className}`}
    >
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {hint}
      </p>

      {/* Interactive Trigger (Optional) */}
      {onUpload && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUpload}
          className="mt-5 transition-transform active:scale-95"
        >
          <Upload className="h-4 w-4" /> Choose File
        </Button>
      )}

      {/* Helper Suggestion Tags */}
      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface LoadingStateProps {
  label?: string;
  sublabel?: string;
  className?: string;
}

export function LoadingState({
  label = "Turning noise into clarity…",
  sublabel = "Extracting actions, deadlines, and urgency.",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden p-8 ${className}`}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="relative flex items-center justify-center">
          <div 
            className="absolute h-10 w-10 animate-ping rounded-full bg-accent/20" 
            aria-hidden="true" 
          />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-background shadow-inner">
            <LoaderCircle className="h-6 w-6 animate-spin text-accent" />
          </div>
        </div>

        <p className="mt-5 font-mono text-sm font-medium tracking-wide text-ink">
          {label}
        </p>
        {sublabel && (
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            {sublabel}
          </p>
        )}

        <div 
          className="relative mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line/40" 
          aria-hidden="true"
        >
          <div className="absolute inset-y-0 left-0 w-2/5 animate-[shimmer_1.8s_infinite_linear] rounded-full bg-gradient-to-r from-accent/20 via-accent to-accent/20" />
        </div>
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  reason: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  reason,
  title = "Couldn't analyze that",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`p-6 ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
          <TriangleAlert className="h-5 w-5" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-ink">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {reason}
          </p>

          {onRetry && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="dark"
                size="sm"
                onClick={onRetry}
                className="gap-2 font-medium transition-transform active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}