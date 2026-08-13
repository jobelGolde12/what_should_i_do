"use client";

import { useAuth } from "@/context/AuthContext";
import {
  type PlanTier,
  type PlanLimits,
  limitsForTier,
  isProTier,
} from "./plans";

/**
 * Client-side plan hook for UX gating (upsell CTA, disable/hide Pro controls).
 * Never the source of truth — server routes always re-check entitlements.
 */
export function usePlan(): {
  tier: PlanTier;
  isPro: boolean;
  limits: PlanLimits;
} {
  const { plan } = useAuth();
  const tier: PlanTier = plan === "pro" ? "pro" : "free";
  return {
    tier,
    isPro: isProTier(tier),
    limits: limitsForTier(tier),
  };
}
