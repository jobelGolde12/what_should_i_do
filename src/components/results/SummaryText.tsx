import { sanitizeSummary, IMPORTANT_PHRASES } from "@/lib/analyzeRules";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HIGHLIGHT_REGEX = (() => {
  const sorted = [...IMPORTANT_PHRASES].sort((a, b) => b.length - a.length);
  return new RegExp(`(${sorted.map(escapeRegExp).join("|")})`, "gi");
})();

/*
 * Structured sentences emitted by the analysis engine ("Action needed: …",
 * "Deadline: …") are pulled out of the prose and rendered as their own
 * labelled rows with the value in bold.
 */
const LABELLED_SENTENCE_REGEX =
  /^(action needed|deadline|next step)\s*:\s*(.+)$/i;

type LabelledRow = {
  label: string;
  value: string;
};

/**
 * Renders text as React text nodes only (never HTML), highlighting important
 * phrases with <mark>.
 */
function Rich({ text }: { text: string }) {
  const parts = text.split(HIGHLIGHT_REGEX).filter((part) => part.length > 0);
  return (
    <>
      {parts.map((part, i) =>
        IMPORTANT_PHRASES.some((p) => part.toLowerCase() === p.toLowerCase()) ? (
          <mark key={i} className="rounded-[2px] bg-surface-2 px-1 text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Renders the model summary as safe plain text with important info bolded:
 * the lead sentence(s) stay as prose, while structured sentences
 * ("Action needed: …", "Deadline: …") get their own labelled row.
 */
export default function SummaryText({ summary }: { summary: string }) {
  const clean = sanitizeSummary(summary);
  if (!clean) return null;

  const leadSentences: string[] = [];
  const rows: LabelledRow[] = [];

  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const match = sentence.match(LABELLED_SENTENCE_REGEX);

    if (!match) {
      leadSentences.push(sentence);
      continue;
    }

    const value = match[2].replace(/\.?\s*$/, "");
    const existing = rows.find(
      (row) => row.label.toLowerCase() === match[1].toLowerCase()
    );

    if (existing) {
      existing.value = `${existing.value}; ${value}`;
    } else {
      rows.push({
        label: match[1].replace(/^./, (c) => c.toUpperCase()),
        value,
      });
    }
  }

  return (
    <div className="space-y-2.5">
      {leadSentences.length > 0 && (
        <p className="text-sm leading-relaxed text-ink">
          <Rich text={leadSentences.join(" ")} />
        </p>
      )}

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1"
        >
          <span className="shrink-0 font-mono text-2xs font-medium uppercase tracking-label-tight text-muted">
            {row.label}
          </span>
          <strong className="text-sm font-semibold leading-relaxed text-ink">
            <Rich text={row.value} />
          </strong>
        </div>
      ))}
    </div>
  );
}
