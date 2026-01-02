"use client";

import { useState } from "react";

type ConfusingPart = {
  sentence: string;
  explanation: string;
};

interface ConfusingPartsProps {
  data: ConfusingPart[];
}

export default function ConfusingParts({ data }: ConfusingPartsProps) {
  const [showAll, setShowAll] = useState(false);

  if (!data || data.length === 0) return null;

  const hasMoreThanTwo = data.length > 2;
  const visibleData =
    hasMoreThanTwo && !showAll ? data.slice(0, 2) : data;

  return (
    <div>
      <div className="flex items-center justify-between">
        <strong className="text-gray-700">Confusing Parts:</strong>

        {hasMoreThanTwo && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showAll ? "Show less" : `Show ${data.length - 2} more`}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {visibleData.map((c, i) => (
          <div
            key={i}
            className="p-4 bg-yellow-50 rounded-lg border border-yellow-100"
          >
            <p className="italic text-gray-700">"{c.sentence}"</p>
            <p className="mt-2 text-sm text-gray-600 pl-4 border-l-2 border-yellow-300">
              {c.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
