"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

type ConfusingPart = {
  sentence: string;
  explanation: string;
};

export default function ConfusingList({
  parts,
}: {
  parts: ConfusingPart[];
}) {
  const [showAll, setShowAll] = useState(false);
  if (parts.length === 0) return null;

  const visible = showAll ? parts : parts.slice(0, 2);
  const hasMore = parts.length > 2;

  return (
    <div>
      <ul className="space-y-3">
        {visible.map((part, i) => (
          <li key={i} className="border-l-2 border-med bg-med-bg px-4 py-3">
            <p className="text-sm italic text-ink">&ldquo;{part.sentence}&rdquo;</p>
            <p className="mt-1.5 pl-3 text-sm text-muted">
              {part.explanation}
            </p>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
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
