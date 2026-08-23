"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ListChecks,
  CalendarDays,
  Gauge,
  CircleHelp,
  CornerDownRight,
  TextQuote,
} from "lucide-react";

import { analyzeText, type AnalysisResult } from "@/app/actions/analyzeText";
import type { AnalysisRecord } from "@/lib/types";
import { useTask } from "@/context/TaskContext";

import {
  streamAnalysis,
  StreamCancelledError,
  StreamUnavailableError,
} from "@/lib/stream";

import { consumePendingTemplate } from "@/lib/applyTemplate";

import ResultsPanel from "@/components/results/ResultsPanel";
import BatchResults, {
  type BatchItem,
} from "@/components/results/BatchResults";

import {
  LoadingState,
  ErrorState,
} from "@/components/ui/States";

import { Button } from "@/components/ui/Button";
// import { AdBlock } from "@/components/layout/AdsRail";
import CleanComposer from "@/components/input/CleanComposer";

const SPECS = [
  {
    label: "Actions",
    icon: ListChecks,
  },
  {
    label: "Deadlines",
    icon: CalendarDays,
  },
  {
    label: "Urgency",
    icon: Gauge,
  },
  {
    label: "Unclear parts",
    icon: CircleHelp,
  },
  {
    label: "Next step",
    icon: CornerDownRight,
  },
  {
    label: "Summary",
    icon: TextQuote,
  },
];

export function DashboardHome() {
  const {
    saveAnalysis,
    deleteAnalysis,
    setItemStatus,
  } = useTask();

  const [text, setText] = useState("");
  const [sourceLabel, setSourceLabel] =
    useState<string | null>(null);

  const [deep] = useState(false);

  const [batchItems, setBatchItems] =
    useState<BatchItem[] | null>(null);

  const [batchLoading, setBatchLoading] =
    useState(false);

  const [partial, setPartial] =
    useState<Partial<AnalysisResult> | null>(null);

  const [result, setResult] =
    useState<AnalysisResult | null>(null);

  const [record, setRecord] =
    useState<AnalysisRecord | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [cancelled, setCancelled] =
    useState(false);

  const [streamed, setStreamed] =
    useState(false);

  const pendingTextRef =
    useRef("");

  const pendingBatchRef =
    useRef<string[]>([]);

  const abortRef =
    useRef<AbortController | null>(null);

  const resultsRef =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLDivElement>(null);

  /*
   * A template applied from another page fills the input.
   */
  useEffect(() => {
    const pending = consumePendingTemplate();

    if (pending) {
      setText(pending);
    }
  }, []);

  /*
   * Cancel active analysis.
   */
  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /*
   * Single analysis.
   */
  const runAnalyze = useCallback(
    async (inputText: string) => {
      const finalText = inputText.trim();

      if (!finalText) {
        return;
      }

      pendingTextRef.current = finalText;

      abortRef.current?.abort();

      const controller =
        new AbortController();

      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setNotice(null);
      setCancelled(false);
      setResult(null);
      setRecord(null);
      setPartial(null);
      setStreamed(false);

      /*
       * Move the result area into view.
       */
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        resultsRef.current?.focus({
          preventScroll: true,
        });
      }, 250);

      try {
        /*
         * Primary streaming path.
         */
        const res = await streamAnalysis(
          finalText,
          (field, value) => {
            setPartial((previous) => ({
              ...previous,
              [field]: value,
            }));
          },
          {
            signal: controller.signal,
            deep,
          }
        );

        setResult(res);

        setRecord(
          saveAnalysis(
            finalText,
            res,
            sourceLabel ?? undefined
          )
        );

        setStreamed(true);
      } catch (streamErr) {
        if (
          streamErr instanceof
          StreamCancelledError
        ) {
          setCancelled(true);
          return;
        }

        if (
          streamErr instanceof
          StreamUnavailableError
        ) {
          setNotice(
            "Streaming was unavailable, so results came from the offline analyzer."
          );
        }

        /*
         * Fallback analyzer.
         */
        try {
          const res =
            await analyzeText(finalText);

          setResult(res);

          setRecord(
            saveAnalysis(
              finalText,
              res,
              sourceLabel ?? undefined
            )
          );
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
    [
      saveAnalysis,
      sourceLabel,
      deep,
    ]
  );

  /*
   * Batch analysis.
   *
   * The feature remains available to the
   * existing application logic, although its
   * secondary controls are intentionally not
   * displayed in the minimalist composer.
   */
  const runBatch = useCallback(
    async (texts: string[]) => {
      if (texts.length === 0) {
        return;
      }

      pendingBatchRef.current = texts;

      abortRef.current?.abort();

      setBatchLoading(true);
      setError(null);
      setNotice(null);
      setBatchItems(null);
      setResult(null);
      setRecord(null);
      setPartial(null);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        resultsRef.current?.focus({
          preventScroll: true,
        });
      }, 250);

      try {
        const res = await fetch(
          "/api/analyze/batch",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              texts,
            }),
          }
        );

        const body =
          (await res
            .json()
            .catch(() => ({}))) as {
            results?: {
              text: string;
              output: AnalysisResult;
            }[];
            error?: string;
          };

        if (!res.ok || !body.results) {
          throw new Error(
            body.error ??
              "Batch analysis failed. Try again."
          );
        }

        const items: BatchItem[] =
          body.results.map((item) => {
            const saved =
              saveAnalysis(
                item.text,
                item.output,
                sourceLabel ?? undefined
              );

            return {
              id: saved.id,
              input: item.text,
              output: item.output,
            };
          });

        setBatchItems(items);
      } catch (batchErr) {
        const message =
          batchErr instanceof Error
            ? batchErr.message
            : "Something went wrong.";

        setError(message);
      } finally {
        setBatchLoading(false);
      }
    },
    [saveAnalysis, sourceLabel]
  );

  /*
   * Delete current analysis.
   */
  const handleDelete = useCallback(() => {
    if (!record) {
      return;
    }

    deleteAnalysis(record.id);

    setResult(null);
    setRecord(null);
    setPartial(null);
    setText("");
  }, [
    record,
    deleteAnalysis,
  ]);

  /*
   * Whether results should be shown.
   */
  const showPanel =
    (loading && partial !== null) ||
    (!loading &&
      !error &&
      !cancelled &&
      result !== null);

  /*
   * Scroll to input.
   */
  const focusInput = useCallback(() => {
    inputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setTimeout(() => {
      document
        .getElementById(
          "analysis-textarea"
        )
        ?.focus();
    }, 400);
  }, []);

  return (
    <main
      className="
        min-h-screen
        bg-background
        text-ink
        antialiased
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-5xl
          px-4
          py-6
          sm:px-6
          sm:py-8
          lg:px-8
          lg:py-10
        "
      >
        <div className="flex flex-col">
          {/* ============================================
              RESULT AREA
             ============================================ */}
          <section
            ref={resultsRef}
            tabIndex={-1}
            aria-label="Analysis results"
            className="
              min-h-[55vh]
              scroll-mt-6
              outline-none
            "
          >
            {/* Initial empty state */}
            {!loading &&
              !error &&
              !cancelled &&
              !result &&
              !batchItems &&
              !text.trim() && (
                <div
                  className="
                    flex
                    min-h-[55vh]
                    flex-col
                    items-center
                    justify-center
                    text-center
                  "
                >
                  <h1
                    className="
                      max-w-2xl
                      text-3xl
                      font-bold
                      tracking-[-0.045em]
                      text-ink
                      sm:text-4xl
                      lg:text-5xl
                    "
                  >
                    What would you like
                    to understand?
                  </h1>

                  <p
                    className="
                      mt-4
                      max-w-xl
                      text-sm
                      leading-7
                      text-neutral-500
                      sm:text-base
                    "
                  >
                    Paste anything below and
                    turn it into clear,
                    actionable information.
                  </p>

                  <div
                    className="
                      mt-8
                      flex
                      flex-wrap
                      items-center
                      justify-center
                      gap-x-5
                      gap-y-3
                    "
                  >
                    {SPECS.map((spec) => {
                      const Icon =
                        spec.icon;

                      return (
                        <div
                          key={spec.label}
                          className="
                            flex
                            items-center
                            gap-1.5
                            text-[10px]
                            font-medium
                            uppercase
                            tracking-[0.12em]
                            text-neutral-400
                          "
                        >
                          <Icon
                            className="h-3.5 w-3.5"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />

                          {spec.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Loading */}
            {loading &&
              partial === null &&
              !error && (
                <LoadingState />
              )}

            {/* Batch loading */}
            {batchLoading &&
              !batchItems && (
                <LoadingState />
              )}

            {/* Error */}
            {error && (
              <ErrorState
                reason={error}
                onRetry={() => {
                  if (
                    pendingBatchRef.current
                      .length > 0
                  ) {
                    void runBatch(
                      pendingBatchRef.current
                    );
                  } else if (
                    pendingTextRef.current
                  ) {
                    void runAnalyze(
                      pendingTextRef.current
                    );
                  }
                }}
              />
            )}

            {/* Batch results */}
            {batchItems &&
              !batchLoading && (
                <BatchResults
                  items={batchItems}
                  onClear={() => {
                    setBatchItems(null);
                    setText("");
                    setSourceLabel(null);
                  }}
                />
              )}

            {/* Cancelled */}
            {!batchItems &&
              cancelled && (
                <div
                  role="status"
                  className="
                    mx-auto
                    max-w-3xl
                    rounded-3xl
                    border
                    border-neutral-200
                    bg-white
                    p-6
                    shadow-[0_12px_40px_rgba(0,0,0,0.05)]
                  "
                >
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-black
                    "
                  >
                    Analysis cancelled.
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-neutral-500
                    "
                  >
                    Your input is still
                    here. Run it again when
                    you are ready.
                  </p>

                  {pendingTextRef.current && (
                    <Button
                      variant="dark"
                      size="sm"
                      className="mt-4"
                      onClick={() =>
                        runAnalyze(
                          pendingTextRef.current
                        )
                      }
                    >
                      Try again
                    </Button>
                  )}
                </div>
              )}

            {/* Notice */}
            {notice && !error && (
              <p
                role="status"
                className="
                  mx-auto
                  mt-4
                  max-w-3xl
                  rounded-2xl
                  border
                  border-dashed
                  border-neutral-300
                  bg-neutral-50
                  px-4
                  py-3
                  text-xs
                  leading-relaxed
                  text-neutral-500
                "
              >
                {notice}
              </p>
            )}

            {/* Results */}
            {!batchItems &&
              showPanel && (
                <div
                  className="
                    mx-auto
                    max-w-4xl
                  "
                >
                  <ResultsPanel
                    record={record}
                    streaming={
                      loading
                        ? partial
                        : null
                    }
                    animate={!streamed}
                    sourceLabel={
                      sourceLabel
                    }
                    onDelete={
                      handleDelete
                    }
                    onCancel={
                      loading
                        ? cancelAnalysis
                        : undefined
                    }
                    onToggleAction={(
                      index,
                      done
                    ) => {
                      if (record) {
                        setItemStatus(
                          `${record.id}:${index}`,
                          done
                            ? "done"
                            : "todo"
                        );
                      }
                    }}
                  />

                  {!loading && (
                    <div
                      className="
                        mt-5
                        flex
                        justify-center
                      "
                    >
                      <button
                        type="button"
                        onClick={focusInput}
                        className="
                          text-xs
                          font-medium
                          text-neutral-400
                          transition-colors
                          hover:text-black
                        "
                      >
                        Analyze another
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* Text exists but hasn't been submitted */}
            {!loading &&
              !error &&
              !cancelled &&
              !result &&
              !batchItems &&
              text.trim() && (
                <div
                  className="
                    mx-auto
                    max-w-3xl
                    rounded-3xl
                    border
                    border-dashed
                    border-neutral-200
                    px-6
                    py-10
                    text-center
                  "
                >
                  <p
                    className="
                      text-xs
                      font-medium
                      text-neutral-400
                    "
                  >
                    Ready when you are
                  </p>
                </div>
              )}
          </section>

          {/* ============================================
              CLEAN AI COMPOSER
             ============================================ */}
          <section
            ref={inputRef}
            id="analysis-input"
            className="
              sticky
              bottom-4
              z-20
              mx-auto
              mt-4
              w-full
              max-w-4xl
              scroll-mt-8
            "
          >
            <CleanComposer
              text={text}
              onTextChange={setText}
              onAnalyze={runAnalyze}
              loading={
                loading ||
                batchLoading
              }
              onSourceLabel={
                setSourceLabel
              }
            />
          </section>

          {/* Advertisement */}
          {/*
          <div className="mt-8">
            <AdBlock />
          </div>
          */}
        </div>
      </div>
    </main>
  );
}