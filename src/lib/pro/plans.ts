/**
 * Pro plan catalog — the single source of truth for tier names and per-tier
 * limits. Both the billing module and the entitlements/gating module read from
 * here so limits never drift between marketing copy and enforcement.
 */

export type PlanTier = "free" | "pro";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

/** Statuses that grant Pro entitlements. */
export const PRO_GRANTING_STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
];

export type PlanLimits = {
  analysesPerDay: number;
  maxMessageChars: number;
  maxFileBytes: number;
  translationsPerDay: number;
  batchSize: number;
  conversionsPerMonth: number;
  exportsPerDay: number;
  replyDraftsPerDay: number;
  chatMessagesPerDay: number;
  syncEnabled: boolean;
  adFree: boolean;
  replyDrafting: boolean;
  deepAnalysis: boolean;
  prioritySupport: boolean;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    analysesPerDay: 10,
    maxMessageChars: 4_000,
    maxFileBytes: 10 * 1024 * 1024,
    translationsPerDay: 20,
    batchSize: 1,
    conversionsPerMonth: 0,
    exportsPerDay: 0,
    replyDraftsPerDay: 0,
    chatMessagesPerDay: 30,
    syncEnabled: false,
    adFree: false,
    replyDrafting: false,
    deepAnalysis: false,
    prioritySupport: false,
  },
  pro: {
    analysesPerDay: 500,
    maxMessageChars: 50_000,
    maxFileBytes: 25 * 1024 * 1024,
    translationsPerDay: 1_000,
    batchSize: 20,
    conversionsPerMonth: 100,
    exportsPerDay: 200,
    replyDraftsPerDay: 500,
    chatMessagesPerDay: 1_000,
    syncEnabled: true,
    adFree: true,
    replyDrafting: true,
    deepAnalysis: true,
    prioritySupport: true,
  },
};

export const PRO_TIER_DISPLAY: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
};

export function isProTier(tier: PlanTier): boolean {
  return tier === "pro";
}

export function limitsForTier(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier];
}
