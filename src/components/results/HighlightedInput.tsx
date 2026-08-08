"use client";

import { useMemo, type ReactNode } from "react";

type Segment = { text: string; highlight: boolean };

/** Escapes regex metachars, then lets whitespace match flexibly. */
function toRegex(needle: string): RegExp {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\s+/g, "\\s+"), "gi");
}

export default function HighlightedInput({
  text,
  sentences,
}: {
  text: string;
  sentences?: string[];
}) {
  const segments = useMemo<Segment[]>(() => {
    if (!sentences || sentences.length === 0) {
      return [{ text, highlight: false }];
    }

    const matches: { start: number; end: number }[] = [];
    for (const needle of sentences) {
      if (!needle) continue;
      const re = toRegex(needle);
      const m = re.exec(text);
      if (m) matches.push({ start: m.index, end: m.index + m[0].length });
    }

    matches.sort((a, b) => a.start - b.start);

    const out: Segment[] = [];
    let cursor = 0;
    let prevEnd = -1;
    for (const m of matches) {
      if (m.start < prevEnd) continue;
      if (m.start > cursor) {
        out.push({ text: text.slice(cursor, m.start), highlight: false });
      }
      out.push({ text: text.slice(m.start, m.end), highlight: true });
      cursor = m.end;
      prevEnd = m.end;
    }
    if (cursor < text.length) {
      out.push({ text: text.slice(cursor), highlight: false });
    }
    return out;
  }, [text, sentences]);

  const nodes: ReactNode[] = segments.map((seg, i) =>
    seg.highlight ? (
      <mark
        key={i}
        className="bg-med/30 text-ink underline decoration-med underline-offset-2"
      >
        {seg.text}
      </mark>
    ) : (
      <span key={i}>{seg.text}</span>
    )
  );

  return <>{nodes}</>;
}
