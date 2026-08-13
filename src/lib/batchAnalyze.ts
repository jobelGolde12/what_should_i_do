import { aiClient } from "@/lib/ai";
import { runRuleAnalysis } from "@/lib/analyzeRules";
import { getErrorMessage } from "@/lib/errors";
import type { AnalysisResult } from "@/app/actions/analyzeText";

/**
 * Shared batch-analysis loop: tries the AI provider per item and falls back to
 * the rule-based analyser (mirrors `analyzeTextsBatch` in the server action).
 * Used by `POST /api/analyze/batch` so the Pro batch endpoint and the UI share
 * one code path.
 */
export async function analyzeBatchTexts(
  texts: string[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  for (const text of texts) {
    try {
      const { result } = await aiClient.analyzeStructured(text);
      results.push(result);
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn("Batch item AI failed, falling back to rules:", message);
      results.push(runRuleAnalysis(text));
    }
  }
  return results;
}
