"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  MessageCircleQuestion,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { CHAT_PRESETS } from "@/lib/prompts";
import {
  streamAnalysisChat,
  StreamCancelledError,
  type ChatHistoryTurn,
} from "@/lib/stream";
import { Button } from "@/components/ui/Button";
import { useOptionalTask } from "@/context/TaskContext";
import { toast } from "@/lib/toast";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Grounded analysis chat — answers questions about the current analysis using
 * only the original message + the analysis JSON. Hidden on shared/embedded
 * pages (no TaskProvider), mirroring how ReplyPanel gates optional UI.
 */
export default function AnalysisChat({
  recordId,
  message,
  analysis,
}: {
  recordId: string;
  message: string;
  analysis: Record<string, unknown> | null;
}) {
  const task = useOptionalTask();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset per analysis; abort any in-flight request.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setLoading(false);
    setError(null);
  }, [recordId]);

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
  }, [messages, loading]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || loading || !message || !analysis) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
      };
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        streaming: true,
      };

      const history: ChatHistoryTurn[] = messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setError(null);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await streamAnalysisChat(
          message,
          analysis,
          text,
          history,
          (acc) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: acc } : m
              )
            );
          },
          { signal: controller.signal }
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: result.text, streaming: false }
              : m
          )
        );
      } catch (err) {
        const cancelled = err instanceof StreamCancelledError;
        setMessages((prev) => {
          const target = prev.find((m) => m.id === assistantMsg.id);
          // Drop the empty bubble on cancel/error; keep a partial answer.
          if (!target || target.content.trim().length === 0) {
            return prev.filter((m) => m.id !== assistantMsg.id);
          }
          return prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false } : m
          );
        });
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't answer that. Try again."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, message, analysis]
  );

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setLoading(false);
    setInput("");
    toast("Chat cleared", "info");
  }

  // Chat is only for the interactive app (dashboard / analysis pages);
  // shared/embedded pages render without a TaskProvider.
  if (!task) return null;

  return (
    <div
      role="group"
      aria-label="Ask about this analysis"
      className="mt-1"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="analysis-chat-panel"
        className="group/toggle flex w-full items-center justify-between py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          <MessageCircleQuestion className="h-4 w-4 text-muted transition-colors group-hover/toggle:text-ink" strokeWidth={1.8} />
          Ask about this analysis
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="analysis-chat-panel" className="pb-1 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {CHAT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={loading}
                onClick={() => void send(preset)}
                className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>

          <div
            aria-live="polite"
            className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1"
          >
            {messages.length === 0 && !loading && (
              <p className="text-xs text-muted">
                Ask anything about this analysis — try one of the questions
                above.
              </p>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="ml-auto max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-night px-3.5 py-2 text-xs leading-relaxed text-white"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={m.id}
                  className="mr-auto max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2 text-xs leading-relaxed text-ink"
                >
                  {m.content || "\u200B"}
                </div>
              )
            )}

            {loading && (
              <div className="mr-auto inline-flex items-center gap-1.5 rounded-2xl bg-surface-2 px-3.5 py-2 text-xs text-muted">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Thinking…
              </div>
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              disabled={loading}
              rows={1}
              aria-label="Ask about this analysis"
              placeholder="Ask about this analysis…"
              className="min-w-0 flex-1 resize-none rounded-tm bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:bg-background disabled:opacity-60"
            />
            {loading ? (
              <Button size="sm" variant="ghost" onClick={stop} aria-label="Stop answering">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="dark"
                onClick={() => void send(input)}
                disabled={!input.trim() || !message || !analysis}
                aria-label="Send question"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </Button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-high">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
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
      )}
    </div>
  );
}
