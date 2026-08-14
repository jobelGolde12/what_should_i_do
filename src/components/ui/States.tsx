import React from "react";
import { FileText, LoaderCircle, TriangleAlert, Upload, Sparkles, RefreshCw } from "lucide-react";
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
  tags = ["Emails", "Slack Threads", "PDF & Docs", "Raw Notes"],
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line/80 bg-surface/60 p-8 text-center backdrop-blur-sm transition-all duration-300 hover:border-accent/40 hover:bg-surface hover:shadow-lg hover:shadow-accent/5 ${className}`}
    >
      {/* Background ambient glow effect */}
      <div 
        className="pointer-events-none absolute -top-12 -z-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-accent/20" 
        aria-hidden="true" 
      />

      {/* Layered Icon Frame */}
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-background shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:border-accent/30 group-hover:shadow-md">
        <FileText className="h-6 w-6 text-muted transition-colors duration-300 group-hover:text-accent" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-background">
          <Sparkles className="h-2.5 w-2.5" />
        </span>
      </div>

      {/* Text Content */}
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {hint}
      </p>

      {/* Interactive Trigger (Optional) */}
      {onUpload && (
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
          className="mt-5 gap-2 transition-transform active:scale-95"
        >
          <Upload className="h-4 w-4" />
          Choose File
        </Button>
      )}

      {/* Helper Suggestion Tags */}
      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-line/50 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line hover:text-ink"
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
      className={`relative overflow-hidden rounded-2xl border border-line/80 bg-surface/80 p-8 backdrop-blur-sm ${className}`}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        {/* Layered Pulsing Loader */}
        <div className="relative flex items-center justify-center">
          <div 
            className="absolute h-10 w-10 animate-ping rounded-full bg-accent/20" 
            aria-hidden="true" 
          />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-background shadow-inner">
            <LoaderCircle className="h-6 w-6 animate-spin text-accent" />
          </div>
        </div>

        {/* Dynamic Status Text */}
        <p className="mt-5 font-mono text-sm font-medium tracking-wide text-ink">
          {label}
        </p>
        {sublabel && (
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            {sublabel}
          </p>
        )}

        {/* Shimmer Progress Track */}
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
      className={`relative overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-sm transition-all ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Error Badge */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
          <TriangleAlert className="h-5 w-5" />
        </div>

        {/* Content & Call to Action */}
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