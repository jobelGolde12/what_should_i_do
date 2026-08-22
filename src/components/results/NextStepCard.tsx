"use client";

import { ArrowRight, Check, Info } from "lucide-react";
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
    <div>
      <p className="font-mono text-2xs font-medium uppercase tracking-label text-muted">
        If you do only one thing
      </p>
      <p className="mt-2 flex items-start gap-2.5 text-[15px] font-medium leading-relaxed text-ink">
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-ink"
          aria-hidden="true"
          strokeWidth={2}
        />
        <span className="min-w-0">{nextStep}</span>
      </p>
      {reason && (
        <p className="mt-2 flex items-center gap-1.5 pl-[26px] text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {reason}
        </p>
      )}
      {canToggle && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleDone(actionIndex, true)}
          className="mt-3 ml-[26px]"
        >
          <Check className="h-3.5 w-3.5" />
          Mark as done
        </Button>
      )}
    </div>
  );
}
