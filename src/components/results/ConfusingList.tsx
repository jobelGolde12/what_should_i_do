"use client";

import { useState } from "react";
import { Check, Clipboard, Minus, Plus } from "lucide-react";
import type { ConfusingPart, ConfusingPartReason } from "@/app/actions/analyzeText";
import { copyText } from "@/lib/share";
import { toast } from "@/lib/toast";
import { Tooltip } from "@/components/ui/Tooltip";

const REASON_LABEL: Record<ConfusingPartReason, string> = {
  "missing-info": "Missing info",
  ambiguity: "Ambiguous",
  contradiction: "Contradiction",
  jargon: "Jargon",
  incomplete: "Incomplete",
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
      <ul id="confusing-list" className="space-y-4">
        {visible.map((part, i) => {
          const copied = copiedIndex === i;
          return (
            <li key={i} className="group/part">
              <div className="flex flex-wrap items-center gap-2">
                {part.reason && (
                  <span className="font-mono text-xxs uppercase tracking-label-mono text-muted">
                    {REASON_LABEL[part.reason]}
                  </span>
                )}
                {part.severity && (
                  <Tooltip label={`${part.severity} severity`}>
                    <span className="cursor-default font-mono text-xxs uppercase tracking-label-mono text-muted">
                      {part.severity}
                    </span>
                  </Tooltip>
                )}
              </div>
              <p className="mt-1.5 text-sm italic leading-relaxed text-ink">
                &ldquo;{part.sentence}&rdquo;
              </p>
              {part.explanation && (
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {part.explanation}
                </p>
              )}
              {part.suggestion && (
                <div className="mt-2">
                  <Tooltip label={copied ? "Copied" : "Copy clarification question"}>
                    <button
                      type="button"
                      aria-label={
                        copied
                          ? "Copied"
                          : "Copy clarification question"
                      }
                      onClick={() => copyClarification(part, i)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 hover:bg-surface-2 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        copied ? "text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Clipboard className="h-3.5 w-3.5" strokeWidth={1.8} />
                      )}
                    </button>
                  </Tooltip>
                </div>
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
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
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
