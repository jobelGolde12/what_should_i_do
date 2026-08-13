import type { AnalysisResult } from "@/app/actions/analyzeText";
import type { ReplyTone } from "./prompts";

/**
 * Rule-based reply fallback used when the AI provider is unavailable
 * (mirrors the analyzeText fallback posture). Builds a sendable draft from
 * the analysis actions/deadlines/summary instead of failing the feature.
 */
export function fallbackReply(
  message: string,
  analysis: Pick<
    AnalysisResult,
    "actions" | "deadlines" | "urgency" | "summary" | "confusingParts"
  >,
  tone: ReplyTone
): string {
  const opening = openingForTone(tone);
  const lines: string[] = [];

  lines.push(opening);

  if (analysis.summary.trim()) {
    const summary = analysis.summary.trim().replace(/\.+$/, "");
    lines.push(`Thanks for your message. ${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`);
  } else {
    lines.push(`Thanks for your message.`);
  }

  const action = analysis.actions[0];
  if (action) {
    lines.push("");
    lines.push(`I'll ${lowerFirst(action)}.`);
  }

  if (analysis.deadlines.length > 0) {
    lines.push("");
    lines.push(
      `I'll aim to have this done by ${analysis.deadlines[0].toLowerCase()}.`
    );
  }

  if (analysis.confusingParts.length > 0 || unclearSignal(message)) {
    lines.push("");
    lines.push(`Follow-up questions:`);
    lines.push(`- Could you clarify the details I may have missed?`);
  }

  lines.push("");
  lines.push(`Next step: ${action ? `Confirm ${lowerFirst(action)}` : "Let me know if you need anything else"}.`);

  return lines.join("\n");
}

function openingForTone(tone: ReplyTone): string {
  switch (tone) {
    case "casual":
      return "Hi,";
    case "warm":
      return "Hello and thank you,";
    case "brief":
      return "Hi,";
    default:
      return "Hello,";
  }
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function unclearSignal(message: string): boolean {
  return /(?:\?|clarif|not sure|unclear|confus|missing)/i.test(message);
}
