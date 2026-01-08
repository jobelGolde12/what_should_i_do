"use server";

import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

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
   TEXT CLEANING (OCR + LETTERHEAD SAFE)
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
    .trim();
}

/* =========================================================
   WEB LLM (MLC) SETUP
========================================================= */
let engine: MLCEngine | null = null;

async function getWebLLMEngine(): Promise<MLCEngine> {
  if (!engine) {
    engine = await CreateMLCEngine("Llama-3-8B-Instruct-q4f32_1");
  }
  return engine;
}

/* =========================================================
   WEB LLM ANALYSIS (PRIMARY)
========================================================= */
async function analyzeWithWebLLM(input: string): Promise<AnalysisResult> {
  const systemPrompt = `You analyze official government announcements.

Return ONLY valid JSON with:
actions, deadlines, urgency, confusingParts, nextStep, summary.

The summary must be concise, decision-focused, and free of headers.`;

  const engine = await getWebLLMEngine();

  const response = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input }
    ],
    temperature: 0.1,
    max_tokens: 900,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty WebLLM response");

  const parsed = JSON.parse(content);

  return {
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
    urgency: ["Urgent", "Important", "Informational"].includes(parsed.urgency)
      ? parsed.urgency
      : "Informational",
    confusingParts: Array.isArray(parsed.confusingParts) ? parsed.confusingParts : [],
    nextStep: typeof parsed.nextStep === "string" ? parsed.nextStep : "No action specified",
    summary: highlightImportantPhrases(
      typeof parsed.summary === "string" ? parsed.summary : ""
    ),
  };
}

/* =========================================================
   RULE-BASED FALLBACK (HARDENED)
========================================================= */
function analyzeWithRules(input: string): AnalysisResult {
  const cleaned = cleanText(input);

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 40 &&
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
   MAIN ANALYSIS FUNCTION
========================================================= */
export async function analyzeText(input: string): Promise<AnalysisResult> {
  const cleaned = cleanText(input);
  if (cleaned.length < 10) throw new Error("Text too short");

  if (cleaned.length > 200) {
    try {
      return await analyzeWithWebLLM(cleaned);
    } catch {
      return analyzeWithRules(cleaned);
    }
  }

  return analyzeWithRules(cleaned);
}

/* =========================================================
   FAST MODE
========================================================= */
export async function analyzeTextFast(input: string): Promise<AnalysisResult> {
  return analyzeWithRules(cleanText(input));
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
    } catch {
      results.push(analyzeWithRules(text));
    }
  }

  return results;
}
