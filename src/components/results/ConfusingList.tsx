"use client";

import { useState } from "react";
import { Check, Clipboard, Minus, Plus } from "lucide-react";
import type { ConfusingPart, ConfusingPartReason } from "@/app/actions/analyzeText";
import { copyText } from "@/lib/share";
import { toast } from "@/lib/toast";

const REASON_LABEL: Record<ConfusingPartReason, string> = {
  "missing-info": "Missing info",
  ambiguity: "Ambiguous",
  contradiction: "Contradiction",
  jargon: "Jargon",
  incomplete: "Incomplete",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-muted border-line",
  medium: "text-med border-med",
  high: "text-high border-high",
};

export default function ConfusingList({
  parts,
}: {
  parts: ConfusingPart[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  if (parts.length === 0) return null;

  const visible = showAll ? parts : parts.slice(0, 2);
  const hasMore = parts.length > 2;

  async function copyClarification(part: ConfusingPart, index: number) {
    const question = `Can you clarify "${part.sentence}"? ${
      part.suggestion ? part.suggestion + " " : ""
    }(${part.explanation})`;
    const ok = await copyText(question);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast("Clarification question copied", "success");
    } else {
      setCopiedIndex(null);
      toast("Couldn't copy — select the text and copy it manually.", "error");
    }
  }

  return (
    <div>
      <ul id="confusing-list" className="space-y-3">
        {visible.map((part, i) => {
          const copied = copiedIndex === i;
          return (
            <li key={i} className="border-l-2 border-med bg-med-bg px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {part.reason && (
                  <span className="font-mono text-xxs uppercase tracking-label-mono text-med">
                    {REASON_LABEL[part.reason]}
                  </span>
                )}
                {part.severity && (
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-label-mono ${
                      SEVERITY_COLOR[part.severity] ?? SEVERITY_COLOR.low
                    }`}
                  >
                    {part.severity}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm italic text-ink">
                &ldquo;{part.sentence}&rdquo;
              </p>
              <p className="mt-1.5 pl-3 text-sm text-muted">
                {part.explanation}
              </p>
              {part.suggestion && (
                <button
                  type="button"
                  onClick={() => copyClarification(part, i)}
                  className="mt-2 ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3.5 w-3.5" /> Copy clarification
                      question
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          aria-expanded={showAll}
          aria-controls="confusing-list"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark"
        >
          {showAll ? (
            <>
              <Minus className="h-3.5 w-3.5" /> Show less
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> {parts.length - 2} more unclear
              parts
            </>
          )}
        </button>
      )}
    </div>
  );
}
