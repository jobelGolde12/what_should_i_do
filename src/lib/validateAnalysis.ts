/**
 * Strict schema validation + repair for AI analysis output.
 *
 * Guarantees every AI response is shaped into a valid `AnalysisResult`:
 * 1. Try a strict zod parse.
 * 2. On failure, repair (coerce arrays, clamp urgency, trim strings).
 * 3. If the repaired result has no usable content, throw so the AI client can
 *    retry on a different route instead of returning a useless result.
 */
import { z } from "zod";
import type {
  AnalysisResult,
  ConfusingPart,
} from "@/app/actions/analyzeText";
import { cleanActionText, dedupeActions } from "@/lib/actionUtils";
import { dedupeConfusingParts, sanitizeSummary } from "@/lib/analyzeRules";
import {
  extractCompletedFields,
  stripFences,
  STREAM_FIELD_ORDER,
} from "@/lib/streamParse";
import { createError } from "@/lib/errors";

const URGENCIES = ["Urgent", "Important", "Informational"] as const;
const REASONS = [
  "missing-info",
  "ambiguity",
  "contradiction",
  "jargon",
  "incomplete",
] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

const ConfusingPartSchema = z.object({
  sentence: z.string(),
  explanation: z.string(),
  reason: z.enum(REASONS).optional(),
  suggestion: z.string().optional(),
  severity: z.enum(SEVERITIES).optional(),
});

const AnalysisSchema = z.object({
  actions: z.array(z.string()),
  deadlines: z.array(z.string()),
  urgency: z.enum(URGENCIES),
  urgencyReason: z.string().optional(),
  urgencyConfidence: z.number().optional(),
  confusingParts: z.array(ConfusingPartSchema),
  nextStep: z.string(),
  nextStepReason: z.string().optional(),
  nextStepActionIndex: z.number().int().nonnegative().optional(),
  summary: z.string(),
});

const MAX_LIST_ITEMS = 15;

function trimStr(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => sanitizeSummary(v.trim()))
    .filter(Boolean);
}

function asConfusingParts(value: unknown): ConfusingPart[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is ConfusingPart => {
    if (typeof v !== "object" || v === null) return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.sentence === "string" &&
      o.sentence.trim().length > 0 &&
      typeof o.explanation === "string"
    );
  });
}

function clampConfidence(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

/**
 * Assembles a validated `AnalysisResult` from a parsed JSON object. This is a
 * total function: every field is coerced or defaulted, never throws.
 */
function assemble(raw: Record<string, unknown>): AnalysisResult {
  const actions = dedupeActions(asStringArray(raw.actions)).slice(0, MAX_LIST_ITEMS);
  const deadlines = [...new Set(asStringArray(raw.deadlines))].slice(0, MAX_LIST_ITEMS);
  const urgencyRaw = raw.urgency as string;
  const urgency: AnalysisResult["urgency"] = URGENCIES.includes(
    urgencyRaw as (typeof URGENCIES)[number]
  )
    ? (urgencyRaw as AnalysisResult["urgency"])
    : "Informational";

  let nextStepActionIndex: number | undefined;
  if (
    typeof raw.nextStepActionIndex === "number" &&
    Number.isInteger(raw.nextStepActionIndex) &&
    raw.nextStepActionIndex >= 0 &&
    raw.nextStepActionIndex < actions.length
  ) {
    nextStepActionIndex = raw.nextStepActionIndex;
  }

  const nextStepRaw = trimStr(raw.nextStep);

  return {
    actions,
    deadlines,
    urgency,
    urgencyReason: trimStr(raw.urgencyReason, 300),
    urgencyConfidence: clampConfidence(raw.urgencyConfidence),
    confusingParts: dedupeConfusingParts(
      asConfusingParts(raw.confusingParts)
    ).slice(0, MAX_LIST_ITEMS),
    nextStep: nextStepRaw ? cleanActionText(nextStepRaw) : "No action specified",
    nextStepReason: trimStr(raw.nextStepReason, 300),
    nextStepActionIndex,
    summary: sanitizeSummary(trimStr(raw.summary) ?? ""),
    analysisMethod: "ai",
  };
}

function isLowQuality(result: AnalysisResult): boolean {
  return (
    result.actions.length === 0 &&
    result.deadlines.length === 0 &&
    result.confusingParts.length === 0 &&
    result.summary.length < 10
  );
}

/**
 * Parses raw model output (stripping fences, salvaging truncated JSON) and
 * validates + repairs it. Returns the normalized result and whether repair was
 * needed. Throws `INVALID_JSON` / `INVALID_RESPONSE` when the output is
 * unusable so the AI client can retry on another route.
 */
export function analyzeRawResponse(
  input: string | unknown
): { result: AnalysisResult; repaired: boolean } {
  let parsed: unknown = input;
  let repaired = false;

  if (typeof input === "string") {
    const cleaned = stripFences(input).trim();
    if (!cleaned) {
      throw createError("Empty response from AI provider", "INVALID_JSON", true);
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Truncated JSON: salvage whatever complete top-level fields exist.
      const salvaged: Record<string, unknown> = {};
      for (const key of [...STREAM_FIELD_ORDER, "urgencyReason", "urgencyConfidence", "nextStepReason", "nextStepActionIndex"]) {
        const fields = extractCompletedFields(cleaned, [key], null);
        if (key in fields) salvaged[key] = fields[key];
      }
      if (Object.keys(salvaged).length === 0) {
        throw createError("Invalid JSON response from AI provider", "INVALID_JSON", true);
      }
      parsed = salvaged;
      repaired = true;
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw createError("AI response is not a JSON object", "INVALID_RESPONSE", true);
  }

  const raw = parsed as Record<string, unknown>;

  if (!AnalysisSchema.safeParse(raw).success) {
    repaired = true;
  }

  const result = assemble(raw);
  if (isLowQuality(result)) {
    throw createError("AI response had no usable content", "INVALID_RESPONSE", true);
  }

  return { result, repaired };
}

/**
 * Convenience wrapper returning just the validated result. Used by the
 * streaming route for the final authoritative `done` event.
 */
export function validateAndRepairAnalysis(input: string | unknown): AnalysisResult {
  return analyzeRawResponse(input).result;
}
