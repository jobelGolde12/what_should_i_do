/**
 * Progressive JSON field extraction for streaming analysis results.
 *
 * The LLM emits a JSON object field-by-field. As raw text accumulates we want
 * to reveal sections (actions, deadlines, urgency, …) the moment their value is
 * complete — without waiting for the whole document. This module extracts only
 * the top-level fields whose value is fully present in the accumulated text.
 */

const WHITESPACE = /\s/;

/** Scans a complete JSON value starting at `start`; returns it or undefined if incomplete. */
function scanValue(raw: string, start: number): unknown {
  let i = start;
  if (i >= raw.length) return undefined;

  const c = raw[i];

  // Strings
  if (c === '"') {
    let s = "";
    i++;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === "\\") {
        if (i + 1 >= raw.length) return undefined;
        s += raw.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === '"') return s;
      s += ch;
      i++;
    }
    return undefined; // unterminated string
  }

  // Literals
  if (/[-0-9]/.test(c)) {
    let j = i;
    while (j < raw.length && /[-0-9.eE+]/.test(raw[j])) j++;
    return Number(raw.slice(i, j));
  }
  for (const lit of ["true", "false", "null"]) {
    if (raw.startsWith(lit, i)) return raw.slice(i, i + lit.length);
  }

  // Arrays / objects — require balanced closing
  if (c === "[" || c === "{") {
    const open = c;
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inString = false;
    let escaped = false;
    while (i < raw.length) {
      const ch = raw[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else if (ch === '"') {
        inString = true;
      } else if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          const slice = raw.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            return undefined;
          }
        }
      }
      i++;
    }
    return undefined; // still open — incomplete
  }

  return undefined;
}

/**
 * Strips a surrounding ```json / ``` fence if the model wrapped its JSON in
 * one (some providers ignore response_format when streaming).
 */
export function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Extracts every top-level field in `keys` that has a complete value in the
 * partially generated JSON `raw`. Returns only newly-complete fields (or all
 * complete fields when `previous` is null).
 */
export function extractCompletedFields(
  raw: string,
  keys: readonly string[],
  previous: Set<string> | null
): Record<string, unknown> {
  const clean = stripFences(raw);
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    if (previous?.has(key)) continue;

    // Locate the key token followed by a colon.
    const keyToken = `"${key}"`;
    const keyIdx = clean.indexOf(keyToken);
    if (keyIdx === -1) continue;

    const colonIdx = clean.indexOf(":", keyIdx + keyToken.length);
    if (colonIdx === -1) continue;

    let i = colonIdx + 1;
    while (i < clean.length && WHITESPACE.test(clean[i])) i++;

    const value = scanValue(clean, i);
    if (value === undefined) continue;

    out[key] = value;
  }

  return out;
}

/** Ordered list of result fields, matching the order sections render in. */
export const STREAM_FIELD_ORDER = [
  "actions",
  "deadlines",
  "urgency",
  "confusingParts",
  "nextStep",
  "summary",
] as const;
