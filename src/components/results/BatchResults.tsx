"use client";

import { useState } from "react";
import { Check, ChevronDown, Layers3, X } from "lucide-react";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import { UrgencyBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export type BatchItem = {
  id: string;
  input: string;
  output: AnalysisResult;
};

export default function BatchResults({
  items,
  onClear,
}: {
  items: BatchItem[];
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="border border-line bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-muted" />
          <h2 className="font-display text-lg font-medium text-ink">
            Batch results
          </h2>
          <span className="rounded-tm bg-accent-soft px-2 py-0.5 font-mono text-xxs uppercase tracking-label text-accent">
            {items.length} message{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5" /> Close
        </Button>
      </header>

      <ul className="divide-y divide-line">
        {items.map((item, index) => {
          const isOpen = expanded.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-xxs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-sm text-ink">
                    {truncate(item.input, 120)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <UrgencyBadge level={item.output.urgency} />
                  <ChevronDown
                    className={`h-4 w-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line bg-surface px-5 py-4">
                  {item.output.summary && (
                    <p className="text-sm leading-relaxed text-muted">
                      {item.output.summary}
                    </p>
                  )}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 font-mono text-xxs uppercase tracking-label text-muted">
                        Actions
                      </p>
                      <ul className="space-y-1">
                        {item.output.actions.length === 0 && (
                          <li className="text-xs text-muted">None</li>
                        )}
                        {item.output.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-ink">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-low" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 font-mono text-xxs uppercase tracking-label text-muted">
                        Deadlines
                      </p>
                      <ul className="space-y-1">
                        {item.output.deadlines.length === 0 && (
                          <li className="text-xs text-muted">None</li>
                        )}
                        {item.output.deadlines.map((d, i) => (
                          <li key={i} className="text-sm text-ink">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-4 border-t border-line pt-3 font-mono text-xxs uppercase tracking-label text-low">
                    Saved to history &amp; actions board
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function truncate(value: string, max: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}
