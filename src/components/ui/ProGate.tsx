"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { usePlan } from "@/lib/pro/usePlan";

/** Small "Pro" pill. Renders nothing when the user is already Pro. */
export function ProBadge({ showFree = false }: { showFree?: boolean }) {
  const { isPro, tier } = usePlan();
  if (isPro) {
    return (
      <Badge tone="accent" className="gap-1">
        <Crown className="h-3 w-3" /> Pro
      </Badge>
    );
  }
  if (showFree) {
    return <Badge tone="neutral">{tier}</Badge>;
  }
  return null;
}

/**
 * Locked placeholder for a Pro-only control. Renders an upgrade link for free
 * users, or the children (the real control) for Pro users.
 */
export function ProGate({
  feature = "This feature",
  children,
}: {
  feature?: string;
  children?: React.ReactNode;
}) {
  const { isPro } = usePlan();
  if (isPro) return <>{children}</>;

  return (
    <div className="flex items-center justify-between gap-3 border border-dashed border-line bg-surface px-4 py-3">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span>
          <span className="font-semibold text-ink">{feature}</span> is a TaskMind
          Pro feature.
        </span>
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-tm bg-accent-btn px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        <Crown className="h-3.5 w-3.5" /> Upgrade
      </Link>
    </div>
  );
}
