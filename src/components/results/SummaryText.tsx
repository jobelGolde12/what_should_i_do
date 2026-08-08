import { sanitizeSummary, IMPORTANT_PHRASES } from "@/lib/analyzeRules";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HIGHLIGHT_REGEX = (() => {
  const sorted = [...IMPORTANT_PHRASES].sort((a, b) => b.length - a.length);
  return new RegExp(`(${sorted.map(escapeRegExp).join("|")})`, "gi");
})();

/**
 * Renders the summary as plain text with important phrases wrapped in <mark>.
 * Model output is always treated as text nodes — never as HTML — so there is
 * no injection vector (replaces the previous dangerouslySetInnerHTML).
 */
export default function SummaryText({ summary }: { summary: string }) {
  const clean = sanitizeSummary(summary);
  if (!clean) return null;

  const parts = clean.split(HIGHLIGHT_REGEX);
  return (
    <p className="text-sm leading-relaxed text-ink">
      {parts.map((part, i) => {
        const isPhrase = IMPORTANT_PHRASES.some(
          (p) => part.toLowerCase() === p.toLowerCase()
        );
        return isPhrase ? (
          <mark key={i} className="bg-med-bg px-1 text-med">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}
