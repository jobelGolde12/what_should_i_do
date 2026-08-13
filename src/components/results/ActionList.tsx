"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { categorizeAction, type ActionCategory } from "@/lib/actionUtils";
import { urgencyForAction } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  attend: "Attend",
  pay: "Pay",
  submit: "Submit",
  communicate: "Reply",
  document: "Prepare",
  other: "Task",
};

const URGENCY_DOT: Partial<Record<UrgencyLevel, string>> = {
  Urgent: "bg-high",
  Important: "bg-med",
};

export default function ActionList({
  actions,
  onToggle,
}: {
  actions: string[];
  onToggle?: (index: number, done: boolean) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    actions.map(() => false)
  );

  if (actions.length === 0) return null;

  function toggle(index: number) {
    const next = [...checked];
    next[index] = !next[index];
    setChecked(next);
    onToggle?.(index, next[index]);
  }

  return (
    <ul className="space-y-2.5">
      {actions.map((action, i) => {
        const done = checked[i];
        const category = categorizeAction(action);
        const actionUrgency = urgencyForAction(action);
        const dot = URGENCY_DOT[actionUrgency];
        return (
          <li key={i} className="flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              aria-label={
                done
                  ? `Mark "${action}" as not done`
                  : `Mark "${action}" as done`
              }
              onClick={() => toggle(i)}
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                done
                  ? "border-accent bg-accent-btn text-white"
                  : "border-line bg-background hover:border-ink"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
            </button>
            <span
              className={`min-w-0 flex-1 text-sm leading-relaxed ${
                done ? "text-muted line-through decoration-line" : "text-ink"
              }`}
            >
              {action}
            </span>
            {dot && (
              <span
                role="img"
                aria-label={`${actionUrgency} action`}
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
              />
            )}
            <span className="mt-1 shrink-0 font-mono text-xxs uppercase tracking-label-mono text-muted">
              {CATEGORY_LABEL[category]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
