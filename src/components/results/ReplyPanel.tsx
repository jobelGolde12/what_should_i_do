"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PenLine,
  RefreshCw,
  Copy,
  Loader2,
  ChevronDown,
  FileText,
  Send,
  MailCheck,
} from "lucide-react";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import type { ReplyTone } from "@/lib/prompts";
import { streamReplyDraft } from "@/lib/stream";
import { copyText } from "@/lib/share";
import { toast } from "@/lib/toast";
import { usePlan } from "@/lib/pro/usePlan";
import { useOptionalTask } from "@/context/TaskContext";
import { Button } from "@/components/ui/Button";
import { ProGate } from "@/components/ui/ProGate";

const TONES: ReplyTone[] = ["professional", "casual", "brief", "warm"];

type SendContext = {
  available: boolean;
  connected: boolean;
  provider?: "mailgun";
  to?: string;
  subject?: string;
};

function draftStorageKey(draftKey: string): string {
  return `taskmind:reply-draft:${draftKey}`;
}

export default function ReplyPanel({
  draftKey,
  message,
  analysis,
  sourceLabel,
}: {
  draftKey: string | null;
  message: string;
  analysis: AnalysisResult | null;
  sourceLabel?: string | null;
}) {
  const { isPro } = usePlan();
  // Templates are optional UI on shared/embedded pages (no TaskProvider).
  const { templates } = useOptionalTask() ?? { templates: [] };
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReplyTone>("professional");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"ai" | "fallback" | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendCtx, setSendCtx] = useState<SendContext | null>(null);
  const [sendStep, setSendStep] = useState<"idle" | "confirm" | "sending" | "sent">("idle");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state whenever the analyzed record changes (new analysis).
  useEffect(() => {
    setDraft("");
    setError(null);
    setMethod(null);
    setLoading(false);
    setCopied(false);
    setSendCtx(null);
    setSendStep("idle");
    setSendTo("");
    setSendSubject("");
    setSendError(null);
    abortRef.current?.abort();
    if (draftKey) {
      try {
        const saved = window.localStorage.getItem(draftStorageKey(draftKey));
        if (saved) {
          setDraft(saved);
          setMethod("ai");
        }
      } catch {
        /* localStorage unavailable */
      }
    }
  }, [draftKey]);

  function persistDraft(value: string) {
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftStorageKey(draftKey), value);
    } catch {
      /* localStorage unavailable */
    }
  }
  const persistDraftRef = useRef(persistDraft);
  persistDraftRef.current = persistDraft;

  const generate = useCallback(
    async (regenerate: boolean) => {
      if (!message || !analysis) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      setMethod(null);
      setCopied(false);
      if (regenerate) setDraft("");
      try {
        const result = await streamReplyDraft(
          message,
          analysis,
          tone,
          (acc) => setDraft(acc),
          { signal: controller.signal }
        );
        setMethod(result.method);
        persistDraftRef.current(result.draft);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : "Couldn't draft a reply.";
        setError(messageText);
      } finally {
        setLoading(false);
      }
    },
    [message, analysis, tone]
  );

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  async function copyDraft() {
    const ok = await copyText(draft);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Reply draft copied", "success");
    } else {
      toast("Couldn't copy the draft.", "error");
    }
  }

  function startFromTemplate(content: string) {
    setDraft(content);
    persistDraft(content);
    setMethod(null);
    setError(null);
    toast("Template loaded — tweak it, then copy.", "info");
  }

  // Load reply context (To/Subject + connected account) for this analysis.
  useEffect(() => {
    if (!open || !draftKey || !isPro) return;
    let cancelled = false;
    fetch(`/api/inbox/context?analysisId=${encodeURIComponent(draftKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SendContext | null) => {
        if (!cancelled && data?.available && data.connected) setSendCtx(data);
      })
      .catch(() => {
        /* offline — Send stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [open, draftKey, isPro]);

  function openSend() {
    if (!sendCtx) return;
    setSendTo(sendCtx.to ?? "");
    setSendSubject(sendCtx.subject ?? "");
    setSendError(null);
    setSendStep("confirm");
  }

  async function sendReply() {
    if (!draftKey || !sendTo || !sendSubject || !draft) return;
    setSendStep("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: draftKey,
          to: sendTo,
          subject: sendSubject,
          body: draft,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't send the reply.");
      setSendStep("sent");
      toast("Reply sent", "success");
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Couldn't send the reply."
      );
      setSendStep("confirm");
    }
  }

  // ⌘/Ctrl + Shift + C copies the draft while the panel is focused.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (draft) void copyDraft();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label="Reply drafting"
      tabIndex={open ? 0 : undefined}
      className="mt-6 border border-line bg-surface outline-none"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="reply-panel"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          <PenLine className="h-4 w-4 text-muted" />
          Draft a reply
          {draft && !loading && (
            <span className="rounded-tm bg-accent-soft px-1.5 py-0.5 font-mono text-xxs uppercase tracking-label text-accent">
              {method === "fallback" ? "template draft" : "draft ready"}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="reply-panel" className="border-t border-line px-4 py-4">
          {!isPro ? (
            <ProGate feature="Reply drafting" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xxs uppercase tracking-label text-muted">
                  Tone
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tone === t}
                      onClick={() => {
                        if (loading) return;
                        setTone(t);
                      }}
                      className={`rounded-tm px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                        tone === t
                          ? "bg-accent-btn text-white"
                          : "border border-line bg-background text-muted hover:text-ink"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void generate(true)}
                  disabled={loading || !message || !analysis}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : draft ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : (
                    <PenLine className="h-3.5 w-3.5" />
                  )}
                  {loading ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}
                </Button>
                {loading && (
                  <Button variant="ghost" size="sm" onClick={stop}>
                    Stop
                  </Button>
                )}
                {draft && !loading && (
                  <Button variant="outline" size="sm" onClick={() => void copyDraft()}>
                    {copied ? <CheckMark /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy draft"}
                    <kbd className="ml-1 hidden rounded-tm border border-line px-1 font-mono text-xxs sm:inline">
                      ⌘⇧C
                    </kbd>
                  </Button>
                )}
                {draft && !loading && sendStep === "idle" && sendCtx?.connected && (
                  <Button size="sm" onClick={openSend}>
                    <Send className="h-3.5 w-3.5" />
                    Send reply
                  </Button>
                )}
                {templates.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted" />
                    <select
                      aria-label="Start from a template"
                      className="rounded-tm border border-line bg-background px-2 py-1.5 text-xs text-ink outline-none focus:border-ink"
                      onChange={(e) => {
                        const t = templates.find((x) => x.id === e.target.value);
                        if (t) startFromTemplate(t.content);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Start from template…
                      </option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || "Untitled template"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {sourceLabel && (
                <p className="mt-3 flex items-center gap-1.5 font-mono text-xxs uppercase tracking-label text-muted">
                  <FileText className="h-3 w-3" />
                  Based on: {sourceLabel}
                </p>
              )}

              <div className="mt-3 min-h-16" aria-live="polite" aria-atomic="true">
                {loading && (
                  <p className="font-mono text-xs text-muted">
                    Drafting a {tone} reply…
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-xs text-high">
                    {error}
                  </p>
                )}
                {!loading && !error && draft && (
                  <textarea
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      persistDraft(e.target.value);
                    }}
                    aria-label="Reply draft"
                    className="block min-h-24 w-full resize-y border border-line bg-background p-3 text-sm leading-relaxed text-ink outline-none focus:border-ink"
                  />
                )}
                {!loading && !error && !draft && (
                  <p className="text-xs text-muted">
                    Pick a tone and generate a draft to send back.
                  </p>
                )}
              </div>

              {(sendStep === "confirm" || sendStep === "sending") && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="font-mono text-xxs uppercase tracking-label text-muted">
                        To
                      </span>
                      <input
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        disabled={sendStep === "sending"}
                        aria-label="Reply recipient"
                        className="mt-1 block w-full rounded-tm border border-line bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-xxs uppercase tracking-label text-muted">
                        Subject
                      </span>
                      <input
                        value={sendSubject}
                        onChange={(e) => setSendSubject(e.target.value)}
                        disabled={sendStep === "sending"}
                        aria-label="Reply subject"
                        className="mt-1 block w-full rounded-tm border border-line bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink disabled:opacity-60"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    This sends the draft via TaskMind&apos;s email service
                    (Mailgun).
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void sendReply()}
                      disabled={
                        sendStep === "sending" || !sendTo || !sendSubject || !draft
                      }
                    >
                      {sendStep === "sending" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {sendStep === "sending" ? "Sending…" : "Send reply"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSendStep("idle")}
                      disabled={sendStep === "sending"}
                    >
                      Cancel
                    </Button>
                  </div>
                  {sendError && (
                    <p role="alert" className="mt-2 text-xs text-high">
                      {sendError}
                    </p>
                  )}
                </div>
              )}
              {sendStep === "sent" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink">
                  <MailCheck className="h-3.5 w-3.5 text-accent" />
                  Reply sent via Mailgun.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
