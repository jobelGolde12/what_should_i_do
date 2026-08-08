"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Share2, Trash2, Check, ScanLine } from "lucide-react";
import type { AnalysisRecord } from "@/lib/types";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import { formatDateTime } from "@/lib/format";
import { copyShareLink } from "@/lib/share";
import { UrgencyBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import UrgencyMeter from "./UrgencyMeter";
import ActionList from "./ActionList";
import DeadlineList from "./DeadlineList";
import ConfusingList from "./ConfusingList";
import NextStepCard from "./NextStepCard";
import TranslationBlock from "./TranslationBlock";

type Stage = "streaming" | "settling" | "settled";
type Field = Exclude<keyof AnalysisResult, "analysisMethod">;

const FIELDS: Field[] = [
  "actions",
  "deadlines",
  "urgency",
  "confusingParts",
  "nextStep",
  "summary",
];

const FIELD_LABELS: Record<Field, string> = {
  actions: "Actions",
  deadlines: "Deadlines",
  urgency: "Urgency",
  confusingParts: "Unclear",
  nextStep: "Next step",
  summary: "Summary",
};
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
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
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
              done ? "text-ink" : "text-muted/50"
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
  onDelete,
}: {
  record: AnalysisRecord | null;
  streaming?: Partial<AnalysisResult> | null;
  animate?: boolean;
  onDelete?: () => void;
}) {
  const result = record?.output ?? null;
  const isStreaming = !!streaming;
  const [stage, setStage] = useState<Stage>(() =>
    isStreaming ? "streaming" : animate ? "settling" : "settled"
  );
  const [prevStreaming, setPrevStreaming] = useState(isStreaming);
  const [copied, setCopied] = useState(false);

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

  async function handleShare() {
    if (!record) return;
    const ok = await copyShareLink(record);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const urgency = result?.urgency ?? streaming?.urgency;

  return (
    <div
      className={`settle-stage border border-line bg-background ${
        stage === "settling" ? "is-settling" : stage === "settled" ? "settled" : ""
      }`}
    >
      <header className="border-b border-line px-5 py-4 sm:px-6">
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
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              {record ? formatDateTime(record.timestamp) : "Streaming results…"}
            </p>
          </div>

          {record && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </>
                )}
              </Button>
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {isStreaming && (
          <div className="mt-3 border-t border-line pt-3">
            <FieldProgress resolved={resolved} />
          </div>
        )}
      </header>

      <div className="space-y-8 px-5 py-6 sm:px-6">
        <section className={resolved.actions ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Actions</SectionHeading>
          <ActionList actions={result?.actions ?? streaming?.actions ?? []} />
        </section>

        <section className={resolved.deadlines ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Deadlines</SectionHeading>
          <DeadlineList deadlines={result?.deadlines ?? streaming?.deadlines ?? []} />
        </section>

        <section className={resolved.urgency ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Urgency</SectionHeading>
          <UrgencyMeter level={urgency ?? "Informational"} />
        </section>

        <section className={resolved.confusingParts ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Unclear parts</SectionHeading>
          <ConfusingList
            parts={result?.confusingParts ?? streaming?.confusingParts ?? []}
          />
        </section>

        <section className={resolved.nextStep ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Next step</SectionHeading>
          <NextStepCard nextStep={result?.nextStep ?? streaming?.nextStep ?? ""} />
        </section>

        <section className={resolved.summary ? "settle-section revealed" : "settle-section"}>
          <SectionHeading>Summary</SectionHeading>
          <div
            className="max-w-none text-sm leading-relaxed text-ink [&_mark]:bg-med-bg [&_mark]:text-med [&_mark]:px-1"
            dangerouslySetInnerHTML={{ __html: result?.summary ?? streaming?.summary ?? "" }}
          />
          <div className="mt-4">
            <TranslationBlock summary={result?.summary ?? streaming?.summary ?? ""} />
          </div>
        </section>
      </div>
    </div>
  );
}
