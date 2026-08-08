"use server";

import { openRouterAPI } from "@/lib/openrouter";
import {
  createError,
  getErrorMessage,
  AnalysisError,
  ERROR_CODES,
} from "@/lib/errors";
import {
  cleanText,
  enhanceInput,
  analyzeWithRules,
  normalizeAnalysisResult,
} from "@/lib/analyzeRules";

/* =========================================================
   TYPES
========================================================= */
export type AnalysisResult = {
  actions: string[];
  deadlines: string[];
  urgency: "Urgent" | "Important" | "Informational";
  confusingParts: {
    sentence: string;
    explanation: string;
  }[];
  nextStep: string;
  summary: string;
  analysisMethod: "ai" | "fallback";
};

/* =========================================================
   OPENROUTER ANALYSIS (PRIMARY)
 ========================================================= */
async function analyzeWithOpenRouter(input: string): Promise<AnalysisResult> {
  try {
    const result = await openRouterAPI.analyzeText(input);
    return normalizeAnalysisResult(result);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const isRetryable = error instanceof Error && 'retryable' in error ? (error as AnalysisError).retryable : false;
    throw createError(`OpenRouter analysis failed: ${errorMessage}`, 'UNKNOWN_ERROR', isRetryable);
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

  // Try OpenRouter first for better understanding of messy/ambiguous input
  try {
    return await analyzeWithOpenRouter(enhanced);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.warn('OpenRouter failed, falling back to rules:', errorMessage);
    
    if (error instanceof AnalysisError && error.code === ERROR_CODES.ALL_KEYS_EXHAUSTED) {
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
