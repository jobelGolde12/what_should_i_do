"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Mail, Copy } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { ProGate } from "@/components/ui/ProGate";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import SmartLink from "@/components/navigation/SmartLink";
import { formatRelative, snippet } from "@/lib/format";
import { copyText } from "@/lib/share";
import { toast } from "@/lib/toast";

type InboxProvider = "forward";

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

const PROVIDER_LABEL: Record<InboxProvider, string> = {
  forward: "Forwarded",
};

export default function InboxView() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [forwardAddress, setForwardAddress] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forwardFailed, setForwardFailed] = useState(false);

  // Mount fetch: sets state only after the promises resolve, so no setState
  // runs synchronously inside the effect.
  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/inbox"), fetch("/api/inbox/forward")])
      .then(async ([msgRes, fwdRes]) => {
        if (!active) return;
        if (msgRes.ok) {
          setMessages((await msgRes.json()).messages as InboxMessage[]);
        }
        if (fwdRes.ok) {
          const data = (await fwdRes.json()) as { address: string };
          setForwardAddress(data.address);
          setForwardFailed(false);
        } else {
          setForwardFailed(true);
        }
      })
      .catch(() => {
        if (active) {
          setError("Couldn't load your inbox. Try again.");
          setForwardFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setForwardFailed(false);
    try {
      const [msgRes, fwdRes] = await Promise.all([
        fetch("/api/inbox"),
        fetch("/api/inbox/forward"),
      ]);
      if (msgRes.ok) setMessages((await msgRes.json()).messages as InboxMessage[]);
      if (fwdRes.ok) {
        const data = (await fwdRes.json()) as { address: string };
        setForwardAddress(data.address);
        setForwardFailed(false);
      } else {
        setForwardFailed(true);
      }
    } catch {
      setError("Couldn't load your inbox. Try again.");
      setForwardFailed(true);
    }
  }, []);

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
        kicker="Forward email to your private address and TaskMind analyzes it — then reply straight from the result page."
      />

      <ProGate feature="Email inbox">
        <div className="space-y-6">
          <section className="border border-line">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <Mail className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-ink">Forward address</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              {forwardFailed ? (
                <div className="w-full" role="status">
                  <p className="text-sm text-muted">
                    Couldn&apos;t load your forward address.
                  </p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              ) : forwardAddress ? (
                <>
                  <code className="min-w-0 break-all rounded-tm border border-line bg-surface px-3 py-1.5 font-mono text-sm text-ink">
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

            <div className="mt-4" aria-live="polite">
              {messages === null ? (
                <p className="border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
                  Loading…
                </p>
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={messages.length === 0 ? "No messages yet" : "Nothing matches your search"}
                  hint={
                    messages.length === 0
                      ? "Forward an email to your private address — it will be analyzed and show up here."
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
