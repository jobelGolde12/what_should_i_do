"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Mail,
  Loader2,
  Copy,
  Sparkles,
  Link2,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { ProGate } from "@/components/ui/ProGate";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import SmartLink from "@/components/navigation/SmartLink";
import { useNavigation } from "@/lib/navigation";
import { formatRelative, snippet } from "@/lib/format";
import { copyText } from "@/lib/share";
import { toast } from "@/lib/toast";

type InboxProvider = "forward" | "gmail" | "outlook";

type InboxMessage = {
  id: string;
  provider: InboxProvider;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  analysisId: string;
  analyzed: boolean;
  replied: boolean;
};

type ConnectedIntegration = {
  provider: "gmail" | "outlook";
  externalId: string;
  connectedAt: number;
};

type ProviderMessage = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: number;
};

const PROVIDER_LABEL: Record<InboxProvider, string> = {
  forward: "Forwarded",
  gmail: "Gmail",
  outlook: "Outlook",
};

export default function InboxView() {
  const { navigate } = useNavigation();
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [forwardAddress, setForwardAddress] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [liveProvider, setLiveProvider] = useState<"gmail" | "outlook" | null>(
    null
  );
  const [live, setLive] = useState<ProviderMessage[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [msgRes, intRes, fwdRes] = await Promise.all([
        fetch("/api/inbox"),
        fetch("/api/integrations"),
        fetch("/api/inbox/forward"),
      ]);
      if (msgRes.ok) setMessages((await msgRes.json()).messages as InboxMessage[]);
      if (intRes.ok) {
        setConnected((await intRes.json()).integrations as ConnectedIntegration[]);
      }
      if (fwdRes.ok) {
        const data = (await fwdRes.json()) as { address: string };
        setForwardAddress(data.address);
      }
    } catch {
      setError("Couldn't load your inbox. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function fetchLive(provider: "gmail" | "outlook") {
    setLiveLoading(true);
    setLive(null);
    setLiveProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/sync?provider=${provider}&limit=10`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Couldn't fetch messages.");
      }
      setLive((await res.json()).messages as ProviderMessage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't fetch messages.");
      setLive(null);
    } finally {
      setLiveLoading(false);
    }
  }

  async function analyze(provider: "gmail" | "outlook", messageId: string) {
    setAnalyzingId(messageId);
    setError(null);
    try {
      const res = await fetch("/api/inbox/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, messageId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        analysisId?: string;
      };
      if (!res.ok) throw new Error(data.error || "Couldn't analyze that message.");
      toast("Message analyzed — see it in History", "success");
      setLive(null);
      void load();
      if (data.analysisId) navigate(`/analysis/${data.analysisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't analyze that message.");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function copyForwardAddress() {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages ?? [];
    return (messages ?? []).filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
    );
  }, [messages, query]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Inbox"
        kicker="Forward email to TaskMind or pull recent messages from a connected account, then analyze and reply."
      />

      <ProGate feature="Email inbox">
        <div className="space-y-6">
          <section className="border border-line">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <Mail className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-ink">Forward address</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              {forwardAddress ? (
                <>
                  <code className="rounded-tm border border-line bg-surface px-3 py-1.5 font-mono text-sm text-ink">
                    {forwardAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyForwardAddress()}
                  >
                    {copied ? "Copied" : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <p className="w-full text-xs text-muted">
                    Emails sent here are analyzed automatically and appear in
                    History. Set a Mailgun receive route to{" "}
                    <code className="font-mono">*@in.taskmind.app</code>.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">Loading your address…</p>
              )}
            </div>
          </section>

          <section className="border border-line">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted" />
                <h2 className="text-sm font-semibold text-ink">
                  Connected accounts
                </h2>
              </div>
              {connected.length === 0 && (
                <a
                  href="/settings#integrations"
                  className="text-xs font-medium text-accent hover:text-accent-dark"
                >
                  Connect one →
                </a>
              )}
            </div>

            <div className="px-5 py-4">
              {connected.length === 0 ? (
                <p className="text-sm text-muted">
                  Connect Gmail or Outlook to list recent messages and reply
                  straight from TaskMind.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connected.map((integration) => (
                    <button
                      key={integration.provider}
                      type="button"
                      onClick={() => void fetchLive(integration.provider)}
                      disabled={liveLoading}
                      className="inline-flex items-center gap-2 rounded-tm border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
                    >
                      {liveLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 text-muted" />
                      )}
                      Fetch recent · {PROVIDER_LABEL[integration.provider]}
                    </button>
                  ))}
                </div>
              )}

              {liveProvider && (live || liveLoading) && (
                <div className="mt-4">
                  <p className="font-mono text-2xs uppercase tracking-label text-muted">
                    Recent from {PROVIDER_LABEL[liveProvider]}
                  </p>
                  {liveLoading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching
                      messages…
                    </p>
                  ) : live && live.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      No recent messages found.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line border-y border-line">
                      {live!.map((msg) => (
                        <li key={msg.id} className="flex items-start gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">
                              {msg.subject}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {msg.sender} · {formatRelative(msg.receivedAt)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void analyze(liveProvider, msg.id)}
                            disabled={analyzingId === msg.id}
                          >
                            {analyzingId === msg.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            Analyze
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the inbox…"
                  className="h-10 w-full rounded-tm border border-line bg-background pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink"
                  aria-label="Search inbox"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-xs text-high">
                {error}
              </p>
            )}

            <div className="mt-4">
              {messages === null ? (
                <p className="border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
                  Loading…
                </p>
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={messages.length === 0 ? "No messages yet" : "Nothing matches your search"}
                  hint={
                    messages.length === 0
                      ? "Forward an email to your private address or analyze a message from a connected account — it will show up here."
                      : "Try a different search."
                  }
                />
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {filtered.map((msg) => (
                    <li key={msg.id} className="group py-4">
                      <SmartLink
                        href={`/analysis/${msg.analysisId}`}
                        className="block text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={msg.replied ? "accent" : msg.analyzed ? "low" : "neutral"}>
                            {msg.replied ? "Replied" : msg.analyzed ? "Analyzed" : "New"}
                          </Badge>
                          <span className="font-mono text-2xs text-muted">
                            {PROVIDER_LABEL[msg.provider]}
                          </span>
                          <span className="font-mono text-2xs text-muted">
                            {formatRelative(msg.receivedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-ink">
                          {msg.subject}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {msg.sender} · {snippet(msg.snippet, 120)}
                        </p>
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </ProGate>
    </div>
  );
}
