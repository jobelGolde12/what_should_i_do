"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Mail, Copy, Check, Trash2, Loader2 } from "lucide-react";
import { usePlan } from "@/lib/pro/usePlan";
import { toast } from "@/lib/toast";
import { copyText } from "@/lib/share";
import { Button } from "@/components/ui/Button";
import { ProGate } from "@/components/ui/ProGate";

type ConnectedIntegration = {
  provider: "gmail" | "outlook";
  externalId: string;
  connectedAt: number;
};

const PROVIDER_LABEL: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

/**
 * Pro: private forward-to-TaskMind address + connected Gmail/Outlook accounts
 * with connect/disconnect actions.
 */
export function IntegrationsSettings() {
  const { isPro } = usePlan();
  const [forwardAddress, setForwardAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<ConnectedIntegration[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [fwdRes, intRes] = await Promise.all([
        fetch("/api/inbox/forward"),
        fetch("/api/integrations"),
      ]);
      if (fwdRes.ok) {
        const data = (await fwdRes.json()) as { address: string };
        setForwardAddress(data.address);
      }
      if (intRes.ok) {
        setConnected((await intRes.json()).integrations as ConnectedIntegration[]);
      }
    } catch {
      setError("Couldn't load integration settings.");
    }
  }, []);

  useEffect(() => {
    if (isPro) void load();
  }, [isPro, load]);

  async function disconnect(provider: "gmail" | "outlook") {
    setDisconnecting(provider);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't disconnect.");
      toast(`${PROVIDER_LABEL[provider]} disconnected`, "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect.");
    } finally {
      setDisconnecting(null);
    }
  }

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
    <ProGate feature="Email inbox & connections">
      <section id="integrations" className="mt-6 border border-line scroll-mt-24">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Mail className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Email inbox</h2>
        </div>

        <div className="divide-y divide-line">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Connected accounts</p>
                <p className="mt-0.5 text-xs text-muted">
                  Analyze recent messages and send replies from TaskMind.
                </p>
              </div>
              <Link2 className="h-4 w-4 shrink-0 text-muted" />
            </div>

            <ul className="mt-3 divide-y divide-line border-y border-line">
              {(["gmail", "outlook"] as const).map((provider) => {
                const integration = connected?.find((c) => c.provider === provider);
                const busy = disconnecting === provider;
                return (
                  <li
                    key={provider}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="text-sm text-ink">{PROVIDER_LABEL[provider]}</span>
                    {integration ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xs uppercase tracking-label text-muted">
                          Connected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void disconnect(provider)}
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <a
                        href={`/api/integrations/${provider}/connect`}
                        className="inline-flex items-center gap-1.5 rounded-tm bg-accent-btn px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
                      >
                        Connect {PROVIDER_LABEL[provider]}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            {error && (
              <p role="alert" className="mt-3 text-xs text-high">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </ProGate>
  );
}
