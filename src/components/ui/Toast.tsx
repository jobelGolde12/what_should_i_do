"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { getToasts, subscribeToast, type ToastKind } from "@/lib/toast";

const KIND_STYLES: Record<ToastKind, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: "border-accent/40 bg-accent-soft text-ink",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />,
  },
  info: {
    wrap: "border-line bg-surface text-ink",
    icon: <Info className="h-4 w-4 shrink-0 text-muted" />,
  },
  error: {
    wrap: "border-high/40 bg-high-bg text-ink",
    icon: <TriangleAlert className="h-4 w-4 shrink-0 text-high" />,
  },
};

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToast, getToasts, getToasts);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-xs flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-tm border px-3 py-2.5 text-sm shadow-sm ${style.wrap}`}
          >
            {style.icon}
            <span className="min-w-0">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
