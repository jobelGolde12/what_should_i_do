import type { SharePayload } from "./types";

/**
 * Client-safe share helpers. Encryption/decryption lives in `./share-crypto`
 * (server-only, imports node:crypto).
 */

export type ShareOptions = {
  includeInput?: boolean;
  sensitive?: boolean;
};

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
