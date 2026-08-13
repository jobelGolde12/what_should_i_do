"use server";

import { aiClient } from "@/lib/ai";
import { createError, getErrorMessage } from "@/lib/errors";
import {
  buildReplyMessages,
  type ReplyTone,
  TONE_PRESETS,
} from "@/lib/prompts";
import { fallbackReply } from "@/lib/replyFallback";
import type { AnalysisResult } from "./analyzeText";

export type DraftReplyResult = {
  draft: string;
  method: "ai" | "fallback";
  tone: ReplyTone;
};

const MAX_MESSAGE_CHARS = 50_000;

function isReplyTone(value: unknown): value is ReplyTone {
  return typeof value === "string" && value in TONE_PRESETS;
}

/**
 * Drafts a reply for a message + its analysis. Tries the AI provider first;
 * falls back to a rule-based template built from the analysis actions when the
 * provider is unavailable (mirrors `analyzeText`).
 */
export async function draftReply(opts: {
  message: string;
  analysis: AnalysisResult;
  tone: unknown;
}): Promise<DraftReplyResult> {
  const message = typeof opts.message === "string" ? opts.message.trim() : "";
  if (!message) {
    throw createError("Message is empty.", "INPUT_TOO_SHORT");
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    throw createError(
      `Message must be at most ${MAX_MESSAGE_CHARS} characters.`,
      "TEXT_TOO_LONG"
    );
  }
  if (!isReplyTone(opts.tone)) {
    throw createError("Pick a valid tone.", "INVALID_TONE");
  }

  const analysis = opts.analysis;
  const messages = buildReplyMessages({
    message,
    analysis: {
      actions: analysis.actions ?? [],
      deadlines: analysis.deadlines ?? [],
      urgency: analysis.urgency ?? "Informational",
      summary: analysis.summary ?? "",
    },
    tone: opts.tone,
  });

  try {
    const { content } = await aiClient.streamText(messages, () => undefined, {
      maxTokens: 1_200,
    });
    const draft = content.trim();
    if (!draft) throw new Error("Empty reply draft");
    return { draft, method: "ai", tone: opts.tone };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.warn("Reply drafting failed, falling back to template:", errorMessage);
    const draft = fallbackReply(message, analysis, opts.tone);
    return { draft, method: "fallback", tone: opts.tone };
  }
}
