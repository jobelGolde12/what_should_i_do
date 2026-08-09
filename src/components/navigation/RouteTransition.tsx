"use client";

import type { ReactNode } from "react";
import { useNavigation } from "@/lib/navigation";
import { RouteSkeleton } from "@/components/skeletons/RouteSkeletons";

/**
 * Transition boundary: paints the target route's high-fidelity skeleton
 * the instant navigation commits; swaps to children when data is ready.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { state, isLoadingSkeleton, enabled } = useNavigation();

  if (!enabled || !isLoadingSkeleton) {
    return <>{children}</>;
  }

  return (
    <div aria-busy="true" aria-live="polite">
      <RouteSkeleton route={state.targetRoute} />
      <div hidden>{children}</div>
    </div>
  );
}
