"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeText, type AnalysisResult } from "@/app/actions/analyzeText";
import type { AnalysisRecord } from "@/lib/types";
import { useTask } from "@/context/TaskContext";
import { streamAnalysis, StreamCancelledError } from "@/lib/stream";
import { consumePendingTemplate } from "@/lib/applyTemplate";
import {
  Sparkles,
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
  const [partial, setPartial] = useState<Partial<AnalysisResult> | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamed, setStreamed] = useState(false);
  const pendingTextRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

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
      setResult(null);
      setRecord(null);
      setPartial(null);
      setStreamed(false);

      // Primary path: streaming analysis (sections appear progressively).
      try {
        const res = await streamAnalysis(
          finalText,
          (field, value) => {
            setPartial((prev) => ({ ...prev, [field]: value }));
          },
          { signal: controller.signal }
        );
        setResult(res);
        setRecord(saveAnalysis(finalText, res));
        setStreamed(true);
      } catch (streamErr) {
        if (streamErr instanceof StreamCancelledError) {
          setError(streamErr.message);
          return;
        }
        // Fallback: the blocking server action (TokenRouter → rule-based).
        try {
          const res = await analyzeText(finalText);
          setResult(res);
          setRecord(saveAnalysis(finalText, res));
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
    [saveAnalysis]
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
    (loading && partial !== null) || (!loading && !error && result !== null);

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
        <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.55fr_1fr] lg:gap-14 lg:py-20">
          <div>
            <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-label-wide">
              <span className="text-accent">TaskMind</span>
              <span className="h-px w-6 bg-line" aria-hidden="true" />
              <span className="text-muted">Clarity engine</span>
            </p>

            <h1 className="mt-5 font-display text-[2.5rem] font-medium leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl">
              Turn noise into
              <br />
              <span className="underline decoration-accent decoration-2 underline-offset-[10px]">
                clarity.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              Paste a message or drop a document. TaskMind pulls out the
              actions, deadlines, and urgency — then hands you one clear next
              step.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={focusInput}>
                <Sparkles className="h-4 w-4" /> Start analyzing
              </Button>
              <LinkButton variant="dark" size="lg" href="/actions">
                My actions board
              </LinkButton>
            </div>

            <p className="mt-8 inline-flex items-center gap-2.5 font-mono text-2xs uppercase tracking-label text-muted">
              <ArrowDown className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Paste or drop a document to begin
            </p>
          </div>

          <div className="hidden self-end border border-line bg-background lg:block">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-mono text-xxs uppercase tracking-label text-muted">
                Extracted from any text
              </p>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            </div>
            <ul className="divide-y divide-line">
              {SPECS.map((spec, i) => {
                const Icon = spec.icon;
                return (
                  <li
                    key={spec.label}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-xxs text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                      {spec.label}
                    </span>
                    <span className="font-mono text-xxs uppercase tracking-label-mono text-muted">
                      {spec.hint}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </header>

      <div className="px-0 py-8 sm:py-10">
        <InputArea
          text={text}
          onTextChange={setText}
          onAnalyze={runAnalyze}
          loading={loading}
        />

        <div className="mt-8">
          {loading && partial === null && !error && <LoadingState />}
          {error && (
            <ErrorState
              reason={error}
              onRetry={() => runAnalyze(pendingTextRef.current)}
            />
          )}
          {showPanel && (
            <ResultsPanel
              record={record}
              streaming={loading ? partial : null}
              animate={!streamed}
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
          {!loading && !error && !result && !text.trim() && <EmptyState />}
          {!loading && !error && !result && text.trim() && (
            <p className="mt-8 border border-dashed border-line py-10 text-center font-mono text-xs uppercase tracking-label text-muted">
              Press ⌘ Enter or hit Analyze to run
            </p>
          )}
        </div>

        <AdBlock />
      </div>
    </div>
  );
}
