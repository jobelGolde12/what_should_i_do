"use client";

import { useEffect, useState } from "react";
import { Crown, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/lib/pro/usePlan";
import { toast } from "@/lib/toast";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProBadge } from "@/components/ui/ProGate";

type StatusBody = {
  plan?: string;
  status?: string | null;
  currentPeriodEnd?: number | null;
};

export function SubscriptionCard() {
  const { user, status: authStatus, refreshPlan } = useAuth();
  const { isPro } = usePlan();
  const [periodEnd, setPeriodEnd] = useState<number | null>(null);
  const [busy, setBusy] = useState<"portal" | null>(null);

  useEffect(() => {
    if (!user) {
      setPeriodEnd(null);
      return;
    }
    let active = true;
    void fetch("/api/billing/status")
      .then((res) => (res.ok ? (res.json() as Promise<StatusBody>) : null))
      .then((body) => {
        if (!active) return;
        setPeriodEnd(body?.currentPeriodEnd ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast(body.error ?? "Couldn't open billing portal. Try again.", "error");
        return;
      }
      window.location.href = body.url;
    } catch {
      toast("Couldn't open billing portal. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (authStatus === "loading" || authStatus === "anon") return null;

  const renewsAt = periodEnd
    ? new Date(periodEnd * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section id="billing" className="mt-6 border border-line scroll-mt-24">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Crown className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold text-ink">Subscription</h2>
        <span className="ml-auto">
          <ProBadge showFree />
        </span>
      </div>
      <div className="px-5 py-4">
        {isPro ? (
          <>
            <p className="text-sm text-muted">
              You&apos;re on <span className="font-medium text-ink">TaskMind Pro</span>
              {renewsAt ? (
                <>
                  {" "}
                  — renews on <span className="font-medium text-ink">{renewsAt}</span>.
                </>
              ) : (
                "."
              )}
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openPortal()}
                disabled={busy !== null}
              >
                {busy === "portal" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                Manage subscription
              </Button>
              <p className="mt-2 text-xs text-muted">
                Update your payment method, view receipts, or cancel your
                subscription through Stripe.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Upgrade to Pro for unlimited analyses, 50K-character messages,
              reply drafting, batch analysis, and more.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LinkButton
                href="/settings/billing"
                size="sm"
                aria-label="Upgrade to TaskMind Pro"
              >
                <Crown className="h-3.5 w-3.5" />
                Upgrade to Pro
              </LinkButton>
              <button
                type="button"
                onClick={() => void refreshPlan()}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                Refresh plan
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
