"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Share2, Trash2, Check, ScanLine, Square } from "lucide-react";
import type { AnalysisRecord } from "@/lib/types";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import { formatDateTime } from "@/lib/format";
import ShareDialog from "@/components/share/ShareDialog";
import { UrgencyBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import UrgencyMeter from "./UrgencyMeter";
import ActionList from "./ActionList";
import DeadlineList from "./DeadlineList";
import ConfusingList from "./ConfusingList";
import NextStepCard from "./NextStepCard";
import TranslationBlock from "./TranslationBlock";
import SummaryText from "./SummaryText";
import ReplyPanel from "./ReplyPanel";
import AnalysisChat from "./AnalysisChat";

type Stage = "streaming" | "settling" | "settled";
type Field = Exclude<
  keyof AnalysisResult,
  | "analysisMethod"
  | "aiProviderUsed"
  | "urgencyReason"
  | "urgencyConfidence"
  | "nextStepReason"
  | "nextStepActionIndex"
>;

// Reordered to match the visual layout (Inverted Pyramid UX principle)
const FIELDS: Field[] = [
  "summary",
  "actions",
  "deadlines",
  "urgency",
  "confusingParts",
  "nextStep",
];

const FIELD_LABELS: Record<Field, string> = {
  summary: "Summary",
  actions: "Actions",
  deadlines: "Deadlines",
  urgency: "Urgency",
  confusingParts: "Unclear",
  nextStep: "Next step",
};

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-label text-muted">
      <span className="inline-block h-px w-6 bg-accent" aria-hidden="true" />
      {children}
    </h3>
  );
}

function hasValue(field: Field, result: AnalysisResult | null, streaming: Partial<AnalysisResult> | null): boolean {
  const value = result?.[field] ?? streaming?.[field];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

function FieldProgress({
  resolved,
}: {
  resolved: Record<Field, boolean>;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {FIELDS.map((field) => {
        const done = resolved[field];
        return (
          <span
            key={field}
            className={`inline-flex items-center gap-1.5 font-mono text-xxs uppercase tracking-label-tight transition-colors ${
              done ? "text-ink" : "text-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1 w-1 rounded-full transition-colors ${
                done ? "bg-accent" : "bg-line"
              }`}
            />
            {FIELD_LABELS[field]}
          </span>
        );
      })}
    </div>
  );
}

export default function ResultsPanel({
  record,
  streaming = null,
  animate = true,
  sourceLabel = null,
  onDelete,
  onToggleAction,
  onCancel,
}: {
  record: AnalysisRecord | null;
  streaming?: Partial<AnalysisResult> | null;
  animate?: boolean;
  sourceLabel?: string | null;
  onDelete?: () => void;
  onToggleAction?: (index: number, done: boolean) => void;
  onCancel?: () => void;
}) {
  const result = record?.output ?? null;
  const isStreaming = !!streaming;
  const [stage, setStage] = useState<Stage>(() =>
    isStreaming ? "streaming" : animate ? "settling" : "settled"
  );
  const [prevStreaming, setPrevStreaming] = useState(isStreaming);
  const [showShare, setShowShare] = useState(false);

  // When a streaming panel finishes (streaming prop dropped), run the
  // one-shot scanline settle so the resolved content locks in. Adjusted
  // during render per React's "adjusting state when props change" pattern.
  if (prevStreaming !== isStreaming) {
    setPrevStreaming(isStreaming);
    if (prevStreaming && !isStreaming) {
      setStage("settling");
    }
  }

  // Any "settling" pass resolves to settled after the scanline completes.
  useEffect(() => {
    if (stage !== "settling") return;
    const timer = setTimeout(() => setStage("settled"), 1650);
    return () => clearTimeout(timer);
  }, [stage]);

  const resolved = FIELDS.reduce<Record<Field, boolean>>((acc, field) => {
    acc[field] = hasValue(field, result, streaming);
    return acc;
  }, {} as Record<Field, boolean>);

  function handleShare() {
    if (!record) return;
    setShowShare(true);
  }

  const urgency = result?.urgency ?? streaming?.urgency;

  return (
    <div className="settle-stage">
      <header className="px-5 py-4 sm:px-6 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-medium text-ink">
                Analysis results
              </h2>
              {urgency && <UrgencyBadge level={urgency} />}
              {result && (
                <Badge tone="neutral">
                  {result.analysisMethod === "ai" ? "AI analysis" : "Rule-based"}
                </Badge>
              )}
              <span aria-live="polite">
                <Badge tone={stage === "settled" ? "accent" : "neutral"}>
                  {stage === "settled" ? (
                    <>
                      <Check className="h-3 w-3" /> Resolved
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-3 w-3 animate-pulse" /> Resolving…
                    </>
                  )}
                </Badge>
              </span>
            </div>
            <p className="mt-1.5 font-mono text-2xs text-muted">
              {record ? formatDateTime(record.timestamp) : "Streaming results…"}
            </p>
          </div>

          {record && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          )}

          {isStreaming && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <Square className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}

          {isStreaming && (
            <div className="mt-3 pt-3">
              <FieldProgress resolved={resolved} />
            </div>
          )}
        </div>
      </header>

      <div className="space-y-8 px-5 py-6 sm:px-6">
        {/* Summary moved to the top for the "Inverted Pyramid" UX principle */}
        <section className={resolved.summary ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Summary</SectionHeading>
          <SummaryText summary={result?.summary ?? streaming?.summary ?? ""} />
          <div className="mt-4">
            <TranslationBlock summary={result?.summary ?? streaming?.summary ?? ""} />
          </div>
          {record && result && (
            <AnalysisChat
              recordId={record.id}
              message={record.input}
              analysis={result as Record<string, unknown>}
            />
          )}
        </section>

        <section className={resolved.actions ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Actions</SectionHeading>
          <ActionList
            key={record?.id ?? "streaming"}
            actions={result?.actions ?? streaming?.actions ?? []}
            onToggle={onToggleAction}
          />
        </section>

        <section className={resolved.deadlines ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Deadlines</SectionHeading>
          <DeadlineList
            deadlines={result?.deadlines ?? streaming?.deadlines ?? []}
            analysisId={record?.id ?? null}
            actions={result?.actions ?? streaming?.actions ?? []}
          />
        </section>

        <section className={resolved.urgency ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Urgency</SectionHeading>
          <UrgencyMeter
            level={urgency ?? "Informational"}
            reason={
              result?.urgencyReason ??
              streaming?.urgencyReason ??
              undefined
            }
          />
        </section>

        <section className={resolved.confusingParts ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Unclear parts</SectionHeading>
          <ConfusingList
            parts={result?.confusingParts ?? streaming?.confusingParts ?? []}
          />
        </section>

        <section className={resolved.nextStep ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Next step</SectionHeading>
          <NextStepCard
            nextStep={result?.nextStep ?? streaming?.nextStep ?? ""}
            reason={
              result?.nextStepReason ??
              streaming?.nextStepReason ??
              undefined
            }
            actionIndex={
              result?.nextStepActionIndex ??
              streaming?.nextStepActionIndex ??
              undefined
            }
            actionCount={
              (result?.actions ?? streaming?.actions ?? []).length
            }
            onToggleDone={onToggleAction}
          />
        </section>
      </div>

      {record && result && (
        <div className="px-5 pb-6 sm:px-6">
          <ReplyPanel
            draftKey={record.id}
            message={record.input}
            analysis={result}
            sourceLabel={sourceLabel ?? record.sourceLabel ?? null}
          />
        </div>
      )}

      {showShare && record && (
        <ShareDialog record={record} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}