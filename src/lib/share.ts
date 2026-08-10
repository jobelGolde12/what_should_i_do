import type { SharePayload } from "./types";

const PREFIX = "enc:";

export type ShareOptions = {
  includeInput?: boolean;
  sensitive?: boolean;
};

function encodePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return PREFIX + encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(token: string): SharePayload | null {
  try {
    let encoded = token.startsWith(PREFIX) ? token.slice(PREFIX.length) : token;
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4) encoded += "=";
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as SharePayload;
    if (!parsed || !parsed.output) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareLink(
  record: {
    input: string;
    output: SharePayload["output"];
    timestamp: number;
  },
  options: ShareOptions = {}
): string {
  const payload: SharePayload = {
    input: record.input,
    output: record.output,
    timestamp: record.timestamp,
    ...(options.includeInput !== undefined
      ? { includeInput: options.includeInput }
      : {}),
    ...(options.sensitive ? { sensitive: true } : {}),
  };
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/share/${PREFIX}${encodePayload(payload).slice(PREFIX.length)}`;
}

export function parseShareToken(token: string): SharePayload | null {
  return decodePayload(token);
}

/** Fallback copy that works even when navigator.clipboard is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function buildShareMarkdown(
  record: {
    input: string;
    output: SharePayload["output"];
    timestamp: number;
  },
  link: string,
  options: ShareOptions = {}
): string {
  const out = record.output;
  const lines: string[] = [];
  lines.push(`# What should I do?`);
  lines.push(``);
  lines.push(`> **Urgency:** ${out.urgency}${out.urgencyReason ? ` — ${out.urgencyReason}` : ""}`);
  if (out.summary) {
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(``);
    lines.push(out.summary);
  }
  if (out.nextStep) {
    lines.push(``);
    lines.push(`## Next step`);
    lines.push(``);
    lines.push(out.nextStep);
  }
  if (out.actions.length > 0) {
    lines.push(``);
    lines.push(`## Actions`);
    lines.push(``);
    out.actions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a}`);
    });
  }
  if (options.includeInput !== false && record.input) {
    lines.push(``);
    lines.push(`## Raw input`);
    lines.push(``);
    lines.push(`> ${record.input.replace(/\n/g, "\n> ")}`);
  }
  lines.push(``);
  lines.push(`_Shared via ${link}_`);
  return lines.join("\n");
}
