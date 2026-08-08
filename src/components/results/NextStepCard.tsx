"use client";

import { Check, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NextStepCard({
  nextStep,
  reason,
  actionIndex,
  actionCount,
  onToggleDone,
}: {
  nextStep: string;
  reason?: string;
  actionIndex?: number;
  actionCount?: number;
  onToggleDone?: (index: number, done: boolean) => void;
}) {
  const canToggle =
    typeof actionIndex === "number" &&
    actionIndex >= 0 &&
    actionIndex < (actionCount ?? 0) &&
    typeof onToggleDone === "function";

  return (
    <div className="border-l-2 border-accent bg-accent-soft px-5 py-4">
      <p className="font-mono text-xxs uppercase tracking-label text-accent">
        If you do only one thing
      </p>
      <p className="mt-1.5 flex items-start gap-2 text-sm font-medium leading-relaxed text-ink">
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        {nextStep}
      </p>
      {reason && (
        <p className="mt-2 flex items-center gap-1.5 pl-6 font-mono text-2xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          {reason}
        </p>
      )}
      {canToggle && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleDone(actionIndex, true)}
          className="mt-3 ml-6 border-accent text-accent hover:bg-accent hover:text-white"
        >
          <Check className="h-3.5 w-3.5" />
          Mark as done
        </Button>
      )}
    </div>
  );
}
