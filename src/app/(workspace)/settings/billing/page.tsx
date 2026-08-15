'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/lib/pro/usePlan';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import {
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type Period = 'monthly' | 'annual';
type Busy = Period | 'portal' | null;

const PRO_FEATURES = [
  'Unlimited AI analyses',
  '50,000-character message limit',
  'Smart reply drafting',
  'Batch document & email analysis',
  'Priority processing & support',
];

const PLANS: Record<Period, { label: string; perMonth: number; note: string; save?: string }> = {
  monthly: { label: 'Pay monthly', perMonth: 20, note: '$20 / month / member' },
  annual: { label: 'Pay annually', perMonth: 16, note: '$16 / month / member', save: 'Save 20%' },
};

export default function BillingPage() {
  const { user, status: authStatus } = useAuth();
  const { isPro } = usePlan();

  const [period, setPeriod] = useState<Period>('monthly');
  const [periodEnd, setPeriodEnd] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    if (!user) {
      setPeriodEnd(null);
      return;
    }
    let active = true;
    void fetch('/api/billing/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!active) return;
        setPeriodEnd(body?.currentPeriodEnd ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  async function startCheckout(price: Period) {
    setBusy(price);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast(body.error ?? "Couldn't start checkout. Try again.", 'error');
        return;
      }
      window.location.href = body.url;
    } catch {
      toast("Couldn't start checkout. Try again.", 'error');
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast(body.error ?? "Couldn't open billing portal. Try again.", 'error');
        return;
      }
      window.location.href = body.url;
    } catch {
      toast("Couldn't open billing portal. Try again.", 'error');
    } finally {
      setBusy(null);
    }
  }

  const account = (user ?? null) as { email?: string; name?: string; displayName?: string } | null;
  const accountName = account?.name || account?.displayName || account?.email || 'Your account';
  const accountEmail = account?.email ?? '';
  const accountInitial = (accountName || 'U').trim().charAt(0).toUpperCase();

  const renewsAt = periodEnd
    ? new Date(periodEnd * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  /* ------------------------------- LOADING ------------------------------- */
  if (authStatus === 'loading') {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-line/60 bg-surface/60">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Loading subscription details...</span>
        </div>
      </div>
    );
  }

  /* ------------------------------- SIGNED OUT ---------------------------- */
  if (authStatus === 'anon') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Subscription &amp; Billing</h1>
          <p className="text-sm text-muted">Manage your plan, payment methods, and billing details.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-ink">Upgrade to TaskMind Pro</h3>
            <p className="mt-1 max-w-md text-sm text-muted">
              Sign in to subscribe. You can analyze for free without an account — Pro unlocks
              unlimited analyses, bigger messages, and batch tools.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => (window.location.href = '/auth/login')}>Sign in</Button>
              <Button variant="outline" onClick={() => (window.location.href = '/auth/register')}>
                Create an account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- MAIN -------------------------------- */
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Subscription &amp; Billing</h1>
        <p className="text-sm text-muted">Manage your plan, payment methods, and billing details.</p>
      </div>

      {isPro ? (
        /* --------------------------- PRO ACTIVE --------------------------- */
        <div className="overflow-hidden rounded-2xl border border-accent/25 bg-surface shadow-sm">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Crown className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active plan
                </div>
                <h3 className="text-lg font-bold tracking-tight text-ink">TaskMind Pro</h3>
                <p className="text-sm text-muted">
                  {renewsAt ? (
                    <>
                      Renews automatically on{' '}
                      <span className="font-semibold text-ink">{renewsAt}</span>.
                    </>
                  ) : (
                    'You have full access to every Pro feature.'
                  )}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void openPortal()}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              {busy === 'portal' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage via Stripe
            </Button>
          </div>

          <div className="flex items-center gap-2 border-t border-line/60 bg-accent/5 px-6 py-3 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Update your card, download receipts, or cancel auto-renewal in the secure Stripe billing
            portal.
          </div>
        </div>
      ) : (
        /* ------------------------- UPGRADE / CHECKOUT ---------------------- */
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {/* Card header */}
          <div className="flex items-start gap-3 border-b border-line/70 px-6 py-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-ink">Upgrade to TaskMind Pro</h3>
              <p className="mt-0.5 text-sm text-muted">
                Go further with unlimited analyses, batch tools & priority support.
              </p>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-6 md:grid-cols-2">
            {/* LEFT — billed to / payment / features */}
            <div className="space-y-6">
              <section>
                <p className="text-xs font-medium text-muted">Billed to</p>
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-muted/10 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {accountInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{accountName}</p>
                    {accountEmail && <p className="truncate text-xs text-muted">{accountEmail}</p>}
                  </div>
                </div>
              </section>

              <section>
                <p className="text-xs font-medium text-muted">Payment details</p>
                <div className="mt-2 rounded-lg border border-line bg-muted/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink">
                      <CreditCard className="h-3.5 w-3.5 text-muted" /> Card
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink">
                      <Landmark className="h-3.5 w-3.5 text-muted" /> Bank
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Entered on the next step in a secure Stripe checkout — your card details never
                    touch our servers.
                  </p>
                </div>
              </section>

              <section>
                <p className="text-xs font-medium text-muted">What&apos;s included</p>
                <ul className="mt-2 space-y-2">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <Check className="h-3 w-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* RIGHT — billing options / total / CTA */}
            <div className="flex flex-col gap-4 md:border-l md:border-line/70 md:pl-8">
              <section>
                <p className="text-xs font-medium text-muted">Billing options</p>
                <div className="mt-2 space-y-2" role="radiogroup" aria-label="Billing period">
                  {(['monthly', 'annual'] as Period[]).map((key) => {
                    const plan = PLANS[key];
                    const selected = period === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPeriod(key)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                          selected
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-line bg-surface hover:border-accent/40'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected ? 'border-accent' : 'border-line'
                          }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-ink">{plan.label}</span>
                          <span className="block text-xs text-muted">{plan.note}</span>
                        </span>
                        {plan.save && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            {plan.save}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Total */}
              <div className="rounded-lg border border-line bg-muted/10 px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-lg font-bold text-ink">
                    ${PLANS[period].perMonth}
                    <span className="ml-1 text-xs font-normal text-muted">/ month</span>
                  </span>
                </div>
                {period === 'annual' && (
                  <p className="mt-0.5 text-right text-xs text-muted">Billed as $192 once a year</p>
                )}
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => void startCheckout(period)}
                  disabled={busy !== null}
                >
                  {busy === period ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {busy === period ? 'Redirecting to checkout…' : 'Upgrade to Pro'}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure Stripe checkout · Cancel anytime
                </p>
                <p className="text-center text-[11px] leading-relaxed text-muted">
                  By continuing, you agree to the Terms and Conditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}