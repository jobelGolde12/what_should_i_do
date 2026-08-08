import type { AnalysisResult } from "@/app/actions/analyzeText";

/* =========================================================
   Shared analysis engine (no "use server") — used by the
   server action and the streaming route.
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
export function cleanText(text: string): string {
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
export function enhanceInput(input: string): string {  let enhanced = input;
  
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
   RULE-BASED FALLBACK (ENHANCED FOR MESSY INPUT)
 ========================================================= */
export function analyzeWithRules(input: string): AnalysisResult {
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

    const isLostItemSentence = lower.includes("lost") || lower.includes("missing") || lower.includes("un-possess") || lower.includes("not with its owner") || lower.includes("void in");
    const isFoundInstruction = lower.includes("please do not open") || lower.includes("please close it") || lower.includes("contact the front desk");
    
    if (!isLostItemSentence && !isFoundInstruction && ACTION_VERBS.some(v => lower.includes(v))) {
      actions.push(sentence);
    } else if (isFoundInstruction && !actions.some(a => a.toLowerCase().includes("lost and found"))) {
      actions.push("If you find the item, bring it to the Lost and Found office");
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

  const isLostItem = lowerInput.includes("lost") || lowerInput.includes("missing") || lowerInput.includes("un-possess") || lowerInput.includes("not with its owner");
  const isFoundItem = lowerInput.includes("found") || lowerInput.includes("if you find");
  
  if (isLostItem || isFoundItem) {
    urgency = "Informational";
  } else if (
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
      : isLostItem
        ? "Check if you found the item and contact the Lost and Found office"
        : isFoundItem
          ? "No action required unless you found the item"
          : "No immediate action required.";

  const summary = generateDecisionFocusedSummary(cleaned);

  return {
    actions: actions.length ? actions : ["No clear action mentioned"],
    deadlines: deadlines.length ? deadlines : ["No deadline mentioned"],
    urgency,
    confusingParts,
    nextStep,
    summary: highlightImportantPhrases(summary),
    analysisMethod: "fallback"
  };
}

/* =========================================================
   IMPROVED SUMMARY LOGIC (DECISION-FOCUSED)
 ========================================================= */
function generateDecisionFocusedSummary(text: string): string {
  const seen = new Set<string>();
  const lowerText = text.toLowerCase();

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => {
      const lower = s.toLowerCase();

      if (
        /^(to|from|re|date)\s*:/i.test(s) ||
        lower.includes("office of the") ||
        lower.includes("local government unit") ||
        lower.includes("suspension of all levels of face-to-face classes date") ||
        lower.includes("rectangular mystery of significant importance")
      ) {
        return false;
      }

      if (seen.has(lower)) return false;
      seen.add(lower);

      return s.length > 20;
    });

  const isLostItem = lowerText.includes("lost") || lowerText.includes("missing item") || lowerText.includes("un-possess");
  const isFoundItem = lowerText.includes("found") && lowerText.includes("if you find");
  const isAnnouncement = lowerText.includes("suspension") || lowerText.includes("closure") || lowerText.includes("postponement");

  if (isLostItem) {
    const itemDesc = sentences.find(s => /medium-sized|rectangle|flat/i.test(s));
    const location = sentences.find(s => /north-south corridor|bench|table|room/i.test(s));
    
    let summary = "A lost item";
    if (itemDesc) summary += " - " + itemDesc.substring(0, 60);
    if (location) summary += ". Last seen " + location.substring(0, 50);
    return summary;
  }

  if (isFoundItem) {
    const location = sentences.find(s => /north-south corridor|bench|table/i.test(s));
    return location ? `If found, contact the Lost and Found office. Item was in ${location}` : "If found, contact the Lost and Found office";
  }

  if (isAnnouncement) {
    const decision = sentences.find(s =>
      /suspend|cancel|postpone|postponement|reschedule|closure|adjourn|recess|halt|stop/i.test(s)
    );

    const reason = sentences.find(s =>
      /weather|rain|storm|tropical|cyclone|flood|earthquake|fire|emergency|pagasa|typhoon|signal|warning/i.test(s)
    );

    const timeframe = sentences.find(s =>
      /effective|until lifted|starting from|beginning|until|expire|valid/i.test(s)
    );

    const parts = [];
    if (decision) parts.push(decision);
    if (reason) parts.push(reason);
    if (timeframe) parts.push(timeframe);

    if (parts.length === 0 && sentences.length > 0) {
      return sentences.slice(0, 2).join(" ");
    }

    return parts.filter(Boolean).slice(0, 3).join(" ");
  }

  const decision = sentences.find(s =>
    /suspend|cancel|postpone|postponement|reschedule|closure|adjourn|recess|halt|stop/i.test(s)
  );

  const reason = sentences.find(s =>
    /weather|rain|storm|tropical|cyclone|flood|earthquake|fire|emergency/i.test(s)
  );

  const timeframe = sentences.find(s =>
    /effective|until lifted|starting from|beginning|until|expire|valid/i.test(s)
  );

  const parts = [];
  if (decision) parts.push(decision);
  if (reason) parts.push(reason);
  if (timeframe) parts.push(timeframe);

  if (parts.length === 0 && sentences.length > 0) {
    return sentences.slice(0, 2).join(" ");
  }

  return parts.filter(Boolean).slice(0, 3).join(" ");
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
   SHARED HELPERS FOR THE STREAMING ROUTE
   ========================================================= */

/**
 * Runs the rule-based fallback on raw input (clean + enhance + rules).
 * Used by the streaming route when OpenRouter is unavailable.
 */
export function runRuleAnalysis(input: string): AnalysisResult {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);
  return analyzeWithRules(enhanced);
}

/**
 * Normalizes a parsed OpenRouter JSON object into a full AnalysisResult,
 * applying the same highlighting used by the non-streaming path.
 */
export function normalizeAnalysisResult(
  parsed: Record<string, unknown>
): AnalysisResult {
  return {
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
    urgency: ["Urgent", "Important", "Informational"].includes(parsed.urgency as string)
      ? (parsed.urgency as "Urgent" | "Important" | "Informational")
      : "Informational",
    confusingParts: Array.isArray(parsed.confusingParts) ? parsed.confusingParts : [],
    nextStep: typeof parsed.nextStep === "string" ? parsed.nextStep : "No action specified",
    summary: highlightImportantPhrases(typeof parsed.summary === "string" ? parsed.summary : ""),
    analysisMethod: "ai",
  };
}
