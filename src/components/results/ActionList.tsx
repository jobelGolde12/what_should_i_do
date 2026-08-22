"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Check,
  ClipboardList,
  CreditCard,
  FileUp,
  ListTodo,
  Reply,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { categorizeAction, type ActionCategory } from "@/lib/actionUtils";
import { urgencyForAction } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";
import { Tooltip } from "@/components/ui/Tooltip";

const CATEGORY_META: Record<ActionCategory, { label: string; icon: LucideIcon }> = {
  attend: { label: "Attend", icon: CalendarCheck },
  pay: { label: "Pay", icon: CreditCard },
  submit: { label: "Submit", icon: FileUp },
  communicate: { label: "Reply", icon: Reply },
  document: { label: "Prepare", icon: ClipboardList },
  other: { label: "Task", icon: ListTodo },
};

const URGENCY_DOT: Partial<Record<UrgencyLevel, string>> = {
  Urgent: "bg-ink",
  Important: "bg-muted",
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
    <ul className="space-y-3">
      {actions.map((action, i) => {
        const done = checked[i];
        const category = categorizeAction(action);
        const actionUrgency = urgencyForAction(action);
        const dot = URGENCY_DOT[actionUrgency];
        const CategoryIcon = CATEGORY_META[category].icon;
        return (
          <li key={i} className="group/action flex items-start gap-3">
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
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                done
                  ? "border-night bg-night text-white"
                  : "border-line bg-transparent hover:border-ink group-hover/action:border-neutral-400"
              }`}
            >
              {done && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </button>
            <span
              className={`min-w-0 flex-1 text-sm leading-relaxed transition-colors ${
                done ? "text-muted line-through decoration-line" : "text-ink"
              }`}
            >
              {action}
            </span>
            <span className="mt-0.5 flex shrink-0 items-center gap-2.5">
              {dot && (
                <Tooltip label={`${actionUrgency} action`}>
                  <span
                    role="img"
                    aria-label={`${actionUrgency} action`}
                    className={`flex h-4 w-4 items-center justify-center`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  </span>
                </Tooltip>
              )}
              <Tooltip label={CATEGORY_META[category].label}>
                <span
                  role="img"
                  aria-label={`${CATEGORY_META[category].label} task`}
                  className="flex h-4 w-4 cursor-default items-center justify-center text-muted transition-colors hover:text-ink"
                >
                  <CategoryIcon className="h-[15px] w-[15px]" strokeWidth={1.8} />
                </span>
              </Tooltip>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
