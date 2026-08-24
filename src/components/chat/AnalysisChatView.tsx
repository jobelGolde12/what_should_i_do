"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import type { ChatTopic } from "@/lib/types";
import { CHAT_PRESETS } from "@/lib/prompts";
import {
  streamAnalysisChat,
  StreamCancelledError,
} from "@/lib/stream";
import { useTask } from "@/context/TaskContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import SmartLink from "@/components/navigation/SmartLink";
import HighlightedInput from "@/components/results/HighlightedInput";
import SafeMarkdown from "@/components/chat/SafeMarkdown";
import { EmptyState } from "@/components/ui/States";
import { snippet, formatDateTime } from "@/lib/format";

/** Hard cap mirrored from the server (`MAX_CHAT_MESSAGES` in users.ts). */
const MAX_MESSAGES = 200;

function titleFor(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

/**
 * Full-page, grounded chat about one analysis. Opened in a new tab from the
 * Summary header. The conversation is persisted locally for everyone and, for
 * signed-up users, synced to the database (`chat_topics`) after every turn —
 * so it survives reloads and is available on other devices.
 */
export default function AnalysisChatView() {
  const params = useParams<{ id: string }>();
  const recordId = params.id ?? "";
  const { loadRecord, chats, saveChatTopic, deleteChats } = useTask();
  const { user, status: authStatus } = useAuth();

  const record = recordId ? loadRecord(recordId) : null;

  // The persisted conversation (null until found locally / pulled remotely).
  const [topic, setTopic] = useState<ChatTopic | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Question whose turn failed — enables one-tap retry.
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  // Index of the assistant message currently showing "Copied".
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pulledRef = useRef(false);

  // Grounding context: prefer the live analysis record; fall back to the
  // snapshot embedded in the topic (restores chats on other devices).
  const contextInput = record?.input ?? topic?.context.input ?? "";
  const contextAnalysis = useMemo(
    () =>
      (record?.output ?? topic?.context.analysis ?? null) as Record<
        string,
        unknown
      > | null,
    [record?.output, topic?.context.analysis]
  );

  const messages = useMemo(() => topic?.messages ?? [], [topic]);

  // Restore the conversation: local first (instant), then the database for
  // signed-up users when there's no local copy or the server copy is newer.
  // Keyed only on identity primitives — reactive objects like `chats` churn
  // identity on every provider update and would cancel an in-flight pull
  // without ever retrying, so they're read through a ref instead.
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  });
  const [restoreSettled, setRestoreSettled] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!recordId || authStatus === "loading") return;

    const local =
      chatsRef.current.find((c) => c.recordId === recordId) ?? null;
    if (local && !topic) setTopic(local);
    if (!userId) {
      // Anonymous: whatever is in localStorage is all there is.
      setRestoreSettled(true);
      return;
    }

    setRestoreSettled(true);
    if (pulledRef.current) return;
    pulledRef.current = true;

    void (async () => {
      try {
        const res = await fetch(
          `/api/chats?recordId=${encodeURIComponent(recordId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { topics?: ChatTopic[] };
        const server = data.topics?.[0] ?? null;
        // Ignore late responses for a different analysis (fast nav).
        if (!server || server.recordId !== recordId) return;
        // Last-write-wins: keep whichever copy was updated more recently.
        if (!local || server.updatedAt >= local.updatedAt) {
          setTopic(server);
          if (!local) saveChatTopic(server);
        }
      } catch {
        /* offline or logged out mid-flight — the local copy rules */
      }
    })();
  }, [recordId, userId, authStatus, topic, saveChatTopic]);

  const notFound =
    restoreSettled && !contextInput && !topic;

  // Cleanup on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Scoped auto-scroll: only the chat list scrolls, never the whole page.
  useEffect(() => {
    const el = bottomRef.current;
    if (el && (messages.length > 0 || loading)) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [messages.length, loading, streamText]);

  /** Persists a topic to localStorage and, when signed in, to the DB. */
  const persistTopic = useCallback(
    (next: ChatTopic) => {
      setTopic(next);
      saveChatTopic(next);
      if (user) {
        void fetch("/api/chats", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: next }),
        }).catch(() => {
          /* kept dirty locally; retried on the next turn */
        });
      }
    },
    [saveChatTopic, user]
  );

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function clearChat() {
    abortRef.current?.abort();
    setTopic(null);
    setError(null);
    setLastFailed(null);
    setLoading(false);
    setInput("");
    deleteChats(recordId);
    if (user && recordId) {
      void fetch(
        `/api/chats?recordId=${encodeURIComponent(recordId)}`,
        { method: "DELETE" }
      ).catch(() => {});
    }
  }

  const runTurn = useCallback(
    async (
      questionRaw: string,
      opts?: { priorTurns?: ChatTopic["messages"]; retry?: boolean }
    ) => {
      const text = questionRaw.trim();
      if (!text || loading || !contextInput || !contextAnalysis) return;

      let turns = opts?.priorTurns ?? messages.filter((m) => m.content.trim().length > 0);

      // Retry/regenerate: the failed attempt's optimistic user bubble is
      // already persisted — drop one trailing duplicate before re-running.
      if (opts?.retry) {
        const last = turns[turns.length - 1];
        if (last && last.role === "user" && last.content === text) {
          turns = turns.slice(0, -1);
        }
      }

      const base: ChatTopic =
        topic ??
        {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          recordId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          context: {
            input: contextInput,
            analysis: contextAnalysis as ChatTopic["context"]["analysis"],
          },
          messages: [],
        };

      const nextMessages = [
        ...turns,
        { role: "user" as const, content: text },
      ];
      // Optimistic user bubble; the answer joins it once streaming resolves.
      persistTopic({
        ...base,
        title: base.title ?? titleFor(text),
        messages: nextMessages.slice(-MAX_MESSAGES),
        updatedAt: Date.now(),
      });
      setInput("");
      setError(null);
      setLastFailed(null);
      setLoading(true);
      setStreamText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await streamAnalysisChat(
          contextInput,
          contextAnalysis,
          text,
          turns.map((m) => ({ role: m.role, content: m.content })),
          (acc) => setStreamText(acc),
          { signal: controller.signal }
        );
        setLastFailed(null);
        persistTopic({
          ...base,
          title: base.title ?? titleFor(text),
          messages: [
            ...nextMessages,
            { role: "assistant" as const, content: result.text },
          ].slice(-MAX_MESSAGES),
          updatedAt: Date.now(),
        });
      } catch (err) {
        // Cancellation is silent — including aborts that surface as raw
        // DOMExceptions when the stop lands before the response headers do.
        const cancelled =
          err instanceof StreamCancelledError || controller.signal.aborted;
        if (!cancelled) {
          setLastFailed(text);
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't answer that. Try again."
          );
        }
        if (!cancelled && streamText && streamText.trim().length > 0) {
          // Keep any useful partial answer that already streamed.
          persistTopic({
            ...base,
            title: base.title ?? titleFor(text),
            messages: [
              ...nextMessages,
              { role: "assistant" as const, content: streamText },
            ].slice(-MAX_MESSAGES),
            updatedAt: Date.now(),
          });
        }
      } finally {
        setLoading(false);
        setStreamText(null);
      }
    },
    [
      loading,
      messages,
      topic,
      recordId,
      contextInput,
      contextAnalysis,
      streamText,
      persistTopic,
    ]
  );

  /** Re-runs the last failed question without duplicating its user bubble. */
  function retryFailed() {
    if (!lastFailed) return;
    void runTurn(lastFailed, { retry: true });
  }

  /** Discards the latest answer and regenerates it from the same question. */
  function regenerate() {
    const msgs = topic?.messages ?? [];
    if (loading || msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role !== "assistant") return;

    let qIndex = -1;
    for (let i = msgs.length - 2; i >= 0; i -= 1) {
      if (msgs[i].role === "user") {
        qIndex = i;
        break;
      }
    }
    if (qIndex === -1) return;

    void runTurn(msgs[qIndex].content, {
      priorTurns: msgs.slice(0, qIndex),
      retry: false,
    });
  }

  async function copyMessage(idx: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  // Auto-resizing composer (grows with content up to ~6 rows).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const urgency = record?.output.urgency ?? topic?.context.analysis?.urgency;
  const actionCount =
    record?.output.actions ?? topic?.context.analysis?.actions ?? [];
  const confusingSentences =
    record?.output.confusingParts ?? topic?.context.analysis?.confusingParts ?? [];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col">
      <h1 className="sr-only">Ask about this analysis</h1>
      <header className="mb-4 flex items-center justify-between gap-4">
        <SmartLink
          href={recordId ? `/analysis/${recordId}` : "/"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to analysis
        </SmartLink>
        <p className="hidden font-mono text-2xs uppercase tracking-label text-muted sm:block">
          Chat mode
        </p>
      </header>

      {notFound ? (
        <EmptyState
          title="Analysis not found"
          hint="This analysis may have been deleted, or it was created on another device. History lives in this browser."
        />
      ) : (
        <>
          {/* Context card — the analysis this chat is grounded on */}
          <section className="mb-6 rounded-tm border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xxs uppercase tracking-label text-muted">
                Original input
              </p>
              <p className="font-mono text-xxs uppercase tracking-label text-muted">
                {record ? formatDateTime(record.timestamp) : "From saved chat"}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              <HighlightedInput
                text={snippet(contextInput, 320)}
                sentences={confusingSentences.map((p) => p.sentence)}
              />
            </p>
            {!record && (
              <p className="mt-2 text-xs text-muted">
                The full analysis isn&apos;t stored on this device — answers are
                grounded on your saved conversation&apos;s snapshot.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-xxs uppercase tracking-label-tight text-muted">
              {urgency && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5">
                  {urgency}
                </span>
              )}
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                {actionCount.length} action{actionCount.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
                Grounded · off-topic questions are declined
              </span>
            </div>
          </section>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {CHAT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={loading}
                onClick={() => void runTurn(preset)}
                className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Conversation */}
          <div
            aria-live="polite"
            className="mt-4 max-h-[55vh] flex-1 space-y-3 overflow-y-auto pr-1"
          >
            {messages.length === 0 && !loading && (
              <p className="text-xs text-muted">
                Ask anything about this analysis — try one of the questions
                above. Conversations are saved{" "}
                {user ? "to your account." : "in this browser."}
              </p>
            )}

            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") {
                return (
                  <div
                    key={`u-${i}`}
                    className="ml-auto max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-night px-3.5 py-2 text-xs leading-relaxed text-white"
                  >
                    {m.content}
                  </div>
                );
              }
              return (
                <div key={`a-${i}`} className="mr-auto max-w-[85%]">
                  <div className="break-words rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2 text-xs leading-relaxed text-ink">
                    <SafeMarkdown text={m.content || "\u200B"} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copyMessage(i, m.content)}
                      aria-label={copiedIdx === i ? "Answer copied" : "Copy answer"}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-xxs uppercase tracking-label-tight text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                    >
                      {copiedIdx === i ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      )}
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                    {isLast && !loading && (
                      <button
                        type="button"
                        onClick={regenerate}
                        aria-label="Regenerate this answer"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-xxs uppercase tracking-label-tight text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        Regenerate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {(loading || (streamText !== null && streamText.length > 0)) && (
              <div className="mr-auto max-w-[85%] break-words rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2 text-xs leading-relaxed text-ink">
                {streamText ? (
                  <SafeMarkdown text={streamText} />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Thinking…
                  </span>
                )}
              </div>
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>

          {/* Composer */}
          <div className="sticky bottom-0 mt-3 bg-background pb-2 pt-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runTurn(input);
                  }
                }}
                disabled={loading}
                rows={1}
                aria-label="Ask about this analysis"
                placeholder="Ask about this analysis…"
                className="min-w-0 flex-1 resize-none overflow-hidden rounded-tm bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:bg-background disabled:opacity-60"
              />
              {loading ? (
                <Button size="sm" variant="ghost" onClick={stop} aria-label="Stop answering">
                  <Square className="h-3.5 w-3.5" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="dark"
                  onClick={() => void runTurn(input)}
                  disabled={!input.trim() || !contextInput || !contextAnalysis}
                  aria-label="Send question"
                >
                  <Send className="h-3.5 w-3.5" /> Send
                </Button>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-2 flex flex-wrap items-center justify-between gap-2"
              >
                <p className="text-xs text-high">{error}</p>
                {lastFailed && !loading && (
                  <button
                    type="button"
                    onClick={retryFailed}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xxs uppercase tracking-label-tight text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Retry
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="font-mono text-xxs uppercase tracking-label text-muted">
                Answers are based only on this analysis.
              </p>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
