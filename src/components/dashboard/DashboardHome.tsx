"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeText, type AnalysisResult } from "@/app/actions/analyzeText";
import type { AnalysisRecord } from "@/lib/types";
import { useTask } from "@/context/TaskContext";
import {
  streamAnalysis,
  StreamCancelledError,
  StreamUnavailableError,
} from "@/lib/stream";
import { consumePendingTemplate } from "@/lib/applyTemplate";
import {
  Play,
  ArrowDown,
  ListChecks,
  CalendarDays,
  Gauge,
  CircleHelp,
  CornerDownRight,
  TextQuote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import InputArea from "@/components/input/InputArea";
import ResultsPanel from "@/components/results/ResultsPanel";
import BatchResults, { type BatchItem } from "@/components/results/BatchResults";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { Button, LinkButton } from "@/components/ui/Button";
import { AdBlock } from "@/components/layout/AdsRail";

const SPECS: { label: string; hint: string; icon: LucideIcon }[] = [
  { label: "Actions", hint: "Checkable list", icon: ListChecks },
  { label: "Deadlines", hint: "Exportable .ics", icon: CalendarDays },
  { label: "Urgency", hint: "Level meter", icon: Gauge },
  { label: "Unclear parts", hint: "Plain-language fixes", icon: CircleHelp },
  { label: "Next step", hint: "One recommendation", icon: CornerDownRight },
  { label: "Summary", hint: "Plain sentences", icon: TextQuote },
];

export function DashboardHome() {
  const { saveAnalysis, deleteAnalysis, setItemStatus } = useTask();
  const [text, setText] = useState("");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [deep, setDeep] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [partial, setPartial] = useState<Partial<AnalysisResult> | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [streamed, setStreamed] = useState(false);
  const pendingTextRef = useRef("");
  const pendingBatchRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // A template applied from another page (Saved / QuickSearch) fills the input.
  useEffect(() => {
    const pending = consumePendingTemplate();
    if (pending) setText(pending);
  }, []);

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runAnalyze = useCallback(
    async (inputText: string) => {
      const finalText = inputText.trim();
      if (!finalText) return;
      pendingTextRef.current = finalText;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      setNotice(null);
      setCancelled(false);
      setResult(null);
      setRecord(null);
      setPartial(null);
      setStreamed(false);

      // Auto-scroll to the results area after state updates trigger the loading UI
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);

      // Primary path: streaming analysis (sections appear progressively).
      try {
        const res = await streamAnalysis(
          finalText,
          (field, value) => {
            setPartial((prev) => ({ ...prev, [field]: value }));
          },
          { signal: controller.signal, deep }
        );
        setResult(res);
        setRecord(saveAnalysis(finalText, res, sourceLabel ?? undefined));
        setStreamed(true);
      } catch (streamErr) {
        if (streamErr instanceof StreamCancelledError) {
          setCancelled(true);
          return;
        }
        // Streaming path unavailable (non-OK response / no body) — explain
        // the switch and fall back to the blocking server action.
        if (streamErr instanceof StreamUnavailableError) {
          setNotice(
            "Streaming was unavailable, so results came from the offline analyzer."
          );
        }
        // Fallback: the blocking server action (TokenRouter → rule-based).
        try {
          const res = await analyzeText(finalText);
          setResult(res);
          setRecord(saveAnalysis(finalText, res, sourceLabel ?? undefined));
        } catch (fallbackErr) {
          const message =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : "Something went wrong.";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [saveAnalysis, sourceLabel, deep]
  );

  const runBatch = useCallback(
    async (texts: string[]) => {
      if (texts.length === 0) return;
      pendingBatchRef.current = texts;
      abortRef.current?.abort();
      setBatchLoading(true);
      setError(null);
      setNotice(null);
      setBatchItems(null);
      setResult(null);
      setRecord(null);
      setPartial(null);

      // Auto-scroll to the results area after state updates trigger the loading UI
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);

      try {
        const res = await fetch("/api/analyze/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          results?: { text: string; output: AnalysisResult }[];
          error?: string;
        };
        if (!res.ok || !body.results) {
          throw new Error(body.error ?? "Batch analysis failed. Try again.");
        }
        const items: BatchItem[] = body.results.map((item) => {
          const record = saveAnalysis(item.text, item.output, sourceLabel ?? undefined);
          return { id: record.id, input: item.text, output: item.output };
        });
        setBatchItems(items);
      } catch (batchErr) {
        const message =
          batchErr instanceof Error ? batchErr.message : "Something went wrong.";
        setError(message);
      } finally {
        setBatchLoading(false);
      }
    },
    [saveAnalysis, sourceLabel]
  );

  const handleDelete = useCallback(() => {
    if (!record) return;
    deleteAnalysis(record.id);
    setResult(null);
    setRecord(null);
    setPartial(null);
    setText("");
  }, [record, deleteAnalysis]);

  const showPanel =
    (loading && partial !== null) ||
    (!loading && !error && !cancelled && result !== null);

  const focusInput = () => {
    document
      .getElementById("analysis-input")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(
      () => document.getElementById("analysis-textarea")?.focus(),
      400
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="dot-grid-fade relative border-b border-line">
        <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.5fr_1fr] lg:gap-16 lg:py-9">
          <div className="flex flex-col justify-center">
            <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-label-wide">
              <span className="text-accent">TaskMind</span>
              <span className="h-px w-6 bg-line" aria-hidden="true" />
              <span className="text-muted">Clarity engine</span>
            </p>

            <h1 className="mt-6 font-display text-4xl font-medium leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl lg:text-6xl">
              Turn noise into
              <br />
              <span className="underline decoration-accent decoration-2 underline-offset-[10px]">
                clarity.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Paste a message or drop a document. TaskMind pulls out the
              actions, deadlines, and urgency — then hands you one clear next
              step.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button size="lg" onClick={focusInput}>
            <Play className="h-4 w-4" /> Start analyzing
          </Button>
          <LinkButton variant="dark" size="lg" href="/actions">
            My actions board
          </LinkButton>
        </div>

            <div className="mt-10 inline-flex max-w-max items-center gap-3 rounded-full border border-line bg-surface px-4 py-2.5 font-mono text-2xs uppercase tracking-label text-muted shadow-sm">
              <ArrowDown className="h-3.5 w-3.5 text-accent animate-bounce" aria-hidden="true" />
              Paste or drop a document to begin
            </div>
          </div>

         <aside className="hidden self-start lg:block">
  <div className="sticky top-8 overflow-hidden rounded-xl border border-line bg-background shadow-sm transition-shadow duration-300 hover:shadow-md motion-reduce:transition-none">
    <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
      <p className="font-mono text-xxs uppercase tracking-label text-muted">
        Extracted from any text
      </p>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75 motion-reduce:animate-none"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
      </span>
    </div>

    <ul className="divide-y divide-line">
      {SPECS.map((spec, i) => {
        const Icon = spec.icon;
        return (
          <li
            key={spec.label}
            className="group px-5 py-4 transition-colors duration-200 hover:bg-surface motion-reduce:transition-none"
          >
            <div className="flex items-start gap-3.5">
              <span className="mt-1 font-mono text-xxs text-muted transition-colors duration-200 group-hover:text-accent motion-reduce:transition-none">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-background transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
                <Icon className="h-3.5 w-3.5 shrink-0 text-accent" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5 text-ink transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                  {spec.label}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-muted transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transform-none motion-reduce:transition-none">
                  {spec.hint}
                </p>
              </div>

              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line transition-all duration-300 group-hover:scale-125 group-hover:bg-accent motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  </div>
</aside>
        </div>
      </header>

      <div className="px-0 py-8 sm:py-10">
        <InputArea
          text={text}
          onTextChange={setText}
          onAnalyze={runAnalyze}
          loading={loading}
          onSourceLabel={setSourceLabel}
          onAnalyzeBatch={runBatch}
          batchLoading={batchLoading}
          deep={deep}
          onDeepChange={setDeep}
        />

        <div className="mt-8 scroll-mt-24" ref={resultsRef}>
          {batchLoading && !batchItems && <LoadingState />}
          {error && (
            <ErrorState
              reason={error}
              onRetry={() => {
                if (pendingBatchRef.current.length > 0) {
                  void runBatch(pendingBatchRef.current);
                } else if (pendingTextRef.current) {
                  runAnalyze(pendingTextRef.current);
                }
              }}
            />
          )}
          {batchItems && !batchLoading && (
            <BatchResults
              items={batchItems}
              onClear={() => {
                setBatchItems(null);
                setText("");
                setSourceLabel(null);
              }}
            />
          )}
          {!batchItems && (
            <>
              {loading && partial === null && !error && <LoadingState />}
              {cancelled && (
                <div
                  role="status"
                  className="border border-line bg-surface px-6 py-6"
                >
                  <p className="text-sm font-semibold text-ink">
                    Analysis cancelled.
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Your input is still here — run it again when you&apos;re ready.
                  </p>
                  {pendingTextRef.current && (
                    <Button
                      variant="dark"
                      size="sm"
                      className="mt-4"
                      onClick={() => runAnalyze(pendingTextRef.current)}
                    >
                      Try again
                    </Button>
                  )}
                </div>
              )}
              {notice && !error && (
                <p
                  role="status"
                  className="mt-4 border border-dashed border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted"
                >
                  {notice}
                </p>
              )}
              {showPanel && (
                <ResultsPanel
                  record={record}
                  streaming={loading ? partial : null}
                  animate={!streamed}
                  sourceLabel={sourceLabel}
                  onDelete={handleDelete}
                  onCancel={loading ? cancelAnalysis : undefined}
                  onToggleAction={(index, done) => {
                    if (record) {
                      setItemStatus(
                        `${record.id}:${index}`,
                        done ? "done" : "todo"
                      );
                    }
                  }}
                />
              )}
              {!loading && !error && !cancelled && !result && !text.trim() && (
                <EmptyState />
              )}
              {!loading && !error && !cancelled && !result && text.trim() && (
                <p className="mt-8 border border-dashed border-line py-10 text-center font-mono text-xs uppercase tracking-label text-muted">
                  Press ⌘ Enter or hit Analyze to run
                </p>
              )}
            </>
          )}
        </div>

        <AdBlock />
      </div>
    </div>
  );
}