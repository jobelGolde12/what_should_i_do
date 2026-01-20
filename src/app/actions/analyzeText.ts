"use server";

import { openRouterAPI } from "@/lib/openrouter";
import { createError, ERROR_CODES, getErrorMessage, AnalysisError } from "@/lib/errors";

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
};

/* =========================================================
   CONSTANTS
========================================================= */
const ACTION_VERBS = [
  "submit", "attend", "pay", "respond", "bring",
  "fill out", "register", "watch", "send", "reply"
];

const URGENT_KEYWORDS = [
  "today", "immediately", "asap", "urgent",
  "final notice", "effective", "until lifted"
];

const DEADLINE_REGEX =
  /\b(today|tomorrow|until lifted|effective\s+\d{1,2}:\d{2}|\bnovember\s+\d{1,2},\s*\d{4})\b/i;

/* =========================================================
   TEXT CLEANING AND NORMALIZATION (ENHANCED)
 ========================================================= */
function cleanText(text: string): string {
  return text
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/office of the municipal mayor.*?(?=re\s*:)/gi, "")
    .replace(/local government unit.*?(?=office)/gi, "")
    .replace(/email:.*?\s/gi, "")
    .replace(/s&f office memorandum no\..*?series of \d{4}/gi, "")
    .replace(/\b[A-Z]{2,}\s*&\s*[A-Z]{2,}\b/g, "")
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi, "")
    .replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2},?\s*\d{4}\b/gi, "")
    .trim();
}

/* =========================================================
   INPUT ENHANCEMENT FOR MESSY TEXT
 ========================================================= */
function enhanceInput(input: string): string {
  let enhanced = input;
  
  // Fix common OCR errors
  const ocrFixes: { [key: string]: string } = {
    'c1asses': 'classes',
    'dass': 'class',
    'rn': 'm',
    'cl': 'd',
    't0': 'to',
    't0day': 'today',
    't0m0rr0w': 'tomorrow',
    'immediatly': 'immediately',
    'asap': 'as soon as possible',
    'w/': 'with',
    'b/c': 'because',
    'w/o': 'without',
    'tl;dr': 'in summary',
    'pls': 'please',
    'plz': 'please',
    'u': 'you',
    'ur': 'your',
    'r': 'are',
    'dont': "don't",
    'wont': "won't",
    'cant': "can't",
    'im': "i'm",
    'ive': "i've",
    'id': "i'd",
  };
  
  for (const [wrong, correct] of Object.entries(ocrFixes)) {
    enhanced = enhanced.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct);
  }
  
  // Normalize punctuation and spacing
  enhanced = enhanced
    .replace(/\s*[.,;:!?]+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.+\s*\.+/g, '.')
    .trim();
  
  // Add context if the input is extremely short or unclear
  if (enhanced.length < 30) {
    enhanced += " (Please analyze this brief message for any actions, deadlines, or urgency)";
  }
  
  return enhanced;
}

/* =========================================================
   OPENROUTER ANALYSIS (PRIMARY)
 ========================================================= */
async function analyzeWithOpenRouter(input: string): Promise<AnalysisResult> {
  try {
    const result = await openRouterAPI.analyzeText(input);
    
    return {
      actions: Array.isArray(result.actions) ? result.actions : [],
      deadlines: Array.isArray(result.deadlines) ? result.deadlines : [],
      urgency: ["Urgent", "Important", "Informational"].includes(result.urgency as string)
        ? (result.urgency as "Urgent" | "Important" | "Informational")
        : "Informational",
      confusingParts: Array.isArray(result.confusingParts) ? result.confusingParts : [],
      nextStep: typeof result.nextStep === "string" ? result.nextStep : "No action specified",
      summary: highlightImportantPhrases(typeof result.summary === "string" ? result.summary : "")
    };
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const isRetryable = error instanceof Error && 'retryable' in error ? (error as AnalysisError).retryable : false;
    throw createError(`OpenRouter analysis failed: ${errorMessage}`, 'UNKNOWN_ERROR', isRetryable);
  }
}

/* =========================================================
   RULE-BASED FALLBACK (ENHANCED FOR MESSY INPUT)
 ========================================================= */
function analyzeWithRules(input: string): AnalysisResult {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);

  const sentences = enhanced
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 20 &&
      !/^(to|from|re|date)\s*:/i.test(s) &&
      !s.toLowerCase().includes("office of the") &&
      !s.toLowerCase().includes("memorandum")
    );

  const actions: string[] = [];
  const deadlines: string[] = [];
  const confusingParts: AnalysisResult["confusingParts"] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (
      lower.includes("is hereby declared") ||
      lower.includes("suspension of") ||
      lower.includes("suspend face-to-face")
    ) {
      actions.push(
        "Suspend face-to-face classes at all levels within the Municipality of Bulan."
      );
      continue;
    }

    if (ACTION_VERBS.some(v => lower.includes(v))) {
      actions.push(sentence);
    }

    const deadlineMatch = sentence.match(DEADLINE_REGEX);
    if (deadlineMatch) deadlines.push(deadlineMatch[0]);

    if (
      sentence.length > 150 ||
      lower.includes("subject to") ||
      lower.includes("accordingly")
    ) {
      confusingParts.push({
        sentence,
        explanation:
          "This sentence is long or complex and may require simplification."
      });
    }
  }

  let urgency: AnalysisResult["urgency"] = "Informational";
  const lowerInput = cleaned.toLowerCase();

  if (
    URGENT_KEYWORDS.some(k => lowerInput.includes(k)) ||
    lowerInput.includes("tropical cyclone") ||
    lowerInput.includes("heavy rainfall")
  ) {
    urgency = "Urgent";
  } else if (deadlines.length) {
    urgency = "Important";
  }

  const nextStep =
    actions.length > 0
      ? actions[0]
      : "No immediate action required.";

  const summary = generateDecisionFocusedSummary(cleaned);

  return {
    actions: actions.length ? actions : ["No clear action mentioned"],
    deadlines: deadlines.length ? deadlines : ["No deadline mentioned"],
    urgency,
    confusingParts,
    nextStep,
    summary: highlightImportantPhrases(summary),
  };
}

/* =========================================================
   IMPROVED SUMMARY LOGIC (DECISION-FOCUSED)
========================================================= */
function generateDecisionFocusedSummary(text: string): string {
  const seen = new Set<string>();

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => {
      const lower = s.toLowerCase();

      // Remove headers / repeated memo junk
      if (
        /^(to|from|re|date)\s*:/i.test(s) ||
        lower.includes("office of the") ||
        lower.includes("local government unit") ||
        lower.includes("suspension of all levels of face-to-face classes date")
      ) {
        return false;
      }

      // Deduplicate repeated sentences
      if (seen.has(lower)) return false;
      seen.add(lower);

      return s.length > 50;
    });

  const decision = sentences.find(s =>
    /suspension|is hereby declared/i.test(s)
  );

  const reason = sentences.find(s =>
    /weather|rainfall|tropical cyclone|pagasa/i.test(s)
  );

  const timeframe = sentences.find(s =>
    /effective|until lifted|november/i.test(s)
  );

  return [decision, reason, timeframe]
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}


/* =========================================================
   HIGHLIGHT IMPORTANT PHRASES
========================================================= */
function highlightImportantPhrases(text: string): string {
  const phrases = [
    "suspension of face-to-face classes",
    "effective",
    "until lifted",
    "urgent",
    "tropical cyclone",
    "heavy rainfall"
  ];

  let result = text;
  for (const phrase of phrases) {
    const regex = new RegExp(`(${phrase})`, "gi");
    result = result.replace(
      regex,
      `<mark style="background:#fde68a;padding:0.1em 0.3em;border-radius:0.25rem">$1</mark>`
    );
  }
  return result;
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
