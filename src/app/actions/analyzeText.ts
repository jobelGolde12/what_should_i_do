"use server";

import { aiClient } from "@/lib/ai";
import {
  createError,
  getErrorMessage,
  AnalysisError,
  ERROR_CODES,
} from "@/lib/errors";
import { cleanText, enhanceInput, analyzeWithRules } from "@/lib/analyzeRules";

/* =========================================================
   TYPES
========================================================= */
export type ConfusingPartReason =
  | "missing-info"
  | "ambiguity"
  | "contradiction"
  | "jargon"
  | "incomplete";

export type ConfusingPart = {
  sentence: string;
  explanation: string;
  reason?: ConfusingPartReason;
  suggestion?: string;
  severity?: "low" | "medium" | "high";
};

export type AnalysisResult = {
  actions: string[];
  deadlines: string[];
  urgency: "Urgent" | "Important" | "Informational";
  urgencyReason?: string;
  urgencyConfidence?: number;
  confusingParts: ConfusingPart[];
  nextStep: string;
  nextStepReason?: string;
  nextStepActionIndex?: number;
  summary: string;
  analysisMethod: "ai" | "fallback";
};

/* =========================================================
   AI ANALYSIS (PRIMARY — TokenRouter)
 ========================================================= */
async function analyzeWithAI(input: string): Promise<AnalysisResult> {
  try {
    const { result } = await aiClient.analyzeStructured(input);
    return result;
  } catch (error: unknown) {
    // Preserve provider-level codes (quota exhausted / not configured) so the
    // caller can surface them instead of silently degrading to rules.
    if (error instanceof AnalysisError) {
      throw error;
    }
    const errorMessage = getErrorMessage(error);
    throw createError(`AI analysis failed: ${errorMessage}`, 'UNKNOWN_ERROR', false);
  }
}

/* =========================================================
   MAIN ANALYSIS FUNCTION (ENHANCED)
 ========================================================= */
export async function analyzeText(input: string): Promise<AnalysisResult> {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);
  
  if (enhanced.length < 10) {
    throw createError("Text too short - please provide more content", 'INPUT_TOO_SHORT');
  }

  // Try the AI provider first for better understanding of messy/ambiguous input
  try {
    return await analyzeWithAI(enhanced);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.warn('AI analysis failed, falling back to rules:', errorMessage);
    
    if (error instanceof AnalysisError &&
        (error.code === ERROR_CODES.ALL_KEYS_EXHAUSTED ||
         error.code === ERROR_CODES.API_KEY_EXHAUSTED)) {
      throw error;
    }
    
    return analyzeWithRules(enhanced);
  }
}

/* =========================================================
   FAST MODE
 ========================================================= */
export async function analyzeTextFast(input: string): Promise<AnalysisResult> {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);
  return analyzeWithRules(enhanced);
}

/* =========================================================
   BATCH MODE
 ========================================================= */
export async function analyzeTextsBatch(
  texts: string[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const text of texts) {
    try {
      results.push(await analyzeText(text));
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.warn('Failed to analyze text:', errorMessage);
      const cleaned = cleanText(text);
      const enhanced = enhanceInput(cleaned);
      results.push(analyzeWithRules(enhanced));
    }
  }

  return results;
}
