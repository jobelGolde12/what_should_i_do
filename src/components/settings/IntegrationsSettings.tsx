"use client";

import { useEffect, useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { usePlan } from "@/lib/pro/usePlan";
import { toast } from "@/lib/toast";
import { copyText } from "@/lib/share";
import { Button } from "@/components/ui/Button";
import { ProGate } from "@/components/ui/ProGate";

/**
 * Pro: private forward-to-TaskMind address (Mailgun receive route). Email
 * forwarded there is analyzed and added to History. No OAuth connections —
 * the inbox runs entirely on Mailgun.
 */
export function IntegrationsSettings() {
  const { isPro } = usePlan();
  const [forwardAddress, setForwardAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mount fetch: sets state only after the promise resolves, so no setState
  // runs synchronously inside the effect.
  useEffect(() => {
    if (!isPro) return;
    let active = true;
    void fetch("/api/inbox/forward")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { address: string } | null) => {
        if (active && data) setForwardAddress(data.address);
      })
      .catch(() => {
        if (active) setError("Couldn't load inbox settings.");
      });
    return () => {
      active = false;
    };
  }, [isPro]);

  async function copyForward() {
    if (!forwardAddress) return;
    const ok = await copyText(forwardAddress);
    if (ok) {
      setCopied(true);
      toast("Forward address copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("Couldn't copy the address.", "error");
    }
  }

  return (
    <ProGate feature="Email inbox">
      <section id="integrations" className="mt-6 border border-line scroll-mt-24">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Mail className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Email inbox</h2>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Forward address</p>
              <p className="mt-0.5 text-xs text-muted">
                Emails forwarded here are analyzed and added to your History.
              </p>
            </div>
            {forwardAddress ? (
              <div className="flex shrink-0 items-center gap-2">
                <code className="rounded-tm border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink">
                  {forwardAddress}
                </code>
                <Button variant="outline" size="sm" onClick={() => void copyForward()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted">Loading…</p>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-xs text-high">
              {error}
            </p>
          )}
        </div>
      </section>
    </ProGate>
  );
}
