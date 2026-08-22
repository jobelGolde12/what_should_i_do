import type { AnalysisResult } from "@/app/actions/analyzeText";
import {
  ACTION_LEXICON,
  dedupeActions,
  extractActionPhrase,
} from "@/lib/actionUtils";
import { classifyUrgency, deadlineHorizon, urgencyForAction } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";

/* =========================================================
   Shared analysis engine (no "use server") — used by the
   server action and the streaming route.
   ========================================================= */

/** Phrases that the summary UI highlights with <mark> (React-safe). */
export const IMPORTANT_PHRASES = [
  "suspension of face-to-face classes",
  "effective",
  "until lifted",
  "urgent",
  "tropical cyclone",
  "heavy rainfall",
];

/**
 * Strips any HTML-ish markup from model output. The summary is always rendered
 * as React text nodes (never via dangerouslySetInnerHTML), but this gives a
 * defense-in-depth layer so tags never leak into plain-text consumers
 * (translation, exports).
 */
export function sanitizeSummary(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/`{1,3}json|```|`/g, "")
    /*
     * Models sometimes emit escaped markdown (\*like this\*) despite the
     * "no markdown" instruction. Unescape first so the emphasis strippers
     * below catch the revealed markers.
     */
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const DEADLINE_REGEX =
  /\b(today|tomorrow|next\s+(week|month|quarter)|end of (the )?(day|month)|eod|until lifted|effective\s+\d{1,2}:\d{2}|bukas|ngayon|mamaya|in\s+\d{1,2}\s+(days?|weeks?|months?)|(?:in|within|for)\s+[a-z]+\s+days?|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\b\d{1,4}\s+(?:am|pm)\b)\b/i;

/* =========================================================
   CONFUSION DETECTION (rule fallback)
   Flags complex, contradictory, jargon-heavy, incomplete, or
   missing-information sentences with a reason + suggestion.
   ========================================================= */
type ConfusingPart = AnalysisResult["confusingParts"][number];

const JARGON_PATTERN = /\b(?:aforementioned|hereby|whereas|henceforth|notwithstanding|per your)\b/i;
const CONTRADICTION_PATTERN =
  /\b(?:however|but|contrary to|notwithstanding the foregoing|unless|except that|while .*\.? but)\b/i;
const INCOMPLETE_PATTERN = /\b(?:tba|tbd|to be determined|et al\.?|placeholder|fill this in|draft only)\b/i;
const MISSING_INFO_PATTERN =
  /(?:please confirm|kindly advise|please advise|will be informed|to follow|\?)\.?$/i;

const CONFUSION_SUGGESTIONS = {
  ambiguity:
    "Ask the sender to split this into shorter, clearer sentences.",
  contradiction:
    "Ask the sender which condition applies to you.",
  jargon:
    "Ask the sender what the acronym or official term means.",
  incomplete:
    "Ask the sender to provide the missing details.",
  "missing-info":
    "Ask the sender to confirm the missing information.",
};

/**
 * Rule-based detection of a confusing sentence. Returns a typed confusing
 * part (reason/severity/suggestion) or null when the sentence is clear.
 */
export function detectConfusingPart(sentence: string): ConfusingPart | null {
  const lower = sentence.toLowerCase();

  if (MISSING_INFO_PATTERN.test(lower)) {
    return {
      sentence,
      explanation:
        "This sentence asks for or promises information that isn't provided here.",
      reason: "missing-info",
      severity: "medium",
      suggestion: CONFUSION_SUGGESTIONS["missing-info"],
    };
  }

  if (INCOMPLETE_PATTERN.test(lower)) {
    return {
      sentence,
      explanation:
        "This sentence looks incomplete or contains placeholder text.",
      reason: "incomplete",
      severity: "high",
      suggestion: CONFUSION_SUGGESTIONS.incomplete,
    };
  }

  if (CONTRADICTION_PATTERN.test(lower) || lower.includes("subject to") || lower.includes("accordingly")) {
    return {
      sentence,
      explanation:
        "This sentence contains conditions or exceptions that may contradict other parts of the message.",
      reason: "contradiction",
      severity: "high",
      suggestion: CONFUSION_SUGGESTIONS.contradiction,
    };
  }

  if (JARGON_PATTERN.test(lower) || /\b[A-Z]{2,}\b/g.test(sentence)) {
    return {
      sentence,
      explanation:
        "This sentence uses official jargon or undefined acronyms.",
      reason: "jargon",
      severity: "low",
      suggestion: CONFUSION_SUGGESTIONS.jargon,
    };
  }

  if (sentence.length > 150) {
    return {
      sentence,
      explanation:
        "This sentence is long and complex and may need simplification.",
      reason: "ambiguity",
      severity: "medium",
      suggestion: CONFUSION_SUGGESTIONS.ambiguity,
    };
  }

  return null;
}

/** Dedupes confusing parts by normalized sentence text. */
export function dedupeConfusingParts(
  parts: ConfusingPart[]
): ConfusingPart[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.sentence.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================================================
   NEXT-STEP PRIORITIZATION (rule fallback)
   Ranks actions by per-action urgency, then nearest deadline
   mentioned in the action, then lexical order.
   ========================================================= */

function actionDeadlineHorizon(action: string): number | null {
  const found = action.match(DEADLINE_REGEX);
  if (!found) return null;
  return deadlineHorizon(found, new Date());
}

export function pickNextStep(opts: {
  actions: string[];
  deadlines: string[];
  urgency: UrgencyLevel;
  isLostItem: boolean;
  isFoundItem: boolean;
}): {
  nextStep: string;
  nextStepReason?: string;
  nextStepActionIndex?: number;
} {
  const { actions, isLostItem, isFoundItem } = opts;

  if (actions.length === 0) {
    if (isLostItem) {
      return {
        nextStep:
          "Check if you found the item and contact the Lost and Found office",
        nextStepReason: "This is a lost-item notice.",
      };
    }
    if (isFoundItem) {
      return {
        nextStep: "No action required unless you found the item",
        nextStepReason: "No obligations stated.",
      };
    }
    return {
      nextStep: "No immediate action required.",
      nextStepReason: "Nothing time-sensitive was detected.",
    };
  }

  const URGENCY_ORDER: Record<UrgencyLevel, number> = {
    Informational: 0,
    Important: 1,
    Urgent: 2,
  };

  const ranked = actions
    .map((action, index) => ({
      action,
      index,
      urgency: urgencyForAction(action),
      horizon: actionDeadlineHorizon(action),
    }))
    .sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency];
      const ub = URGENCY_ORDER[b.urgency];
      if (ua !== ub) return ub - ua;
      const ha = a.horizon ?? Number.POSITIVE_INFINITY;
      const hb = b.horizon ?? Number.POSITIVE_INFINITY;
      if (ha !== hb) return ha - hb;
      return a.action.localeCompare(b.action);
    });

  const top = ranked[0];
  const nextStepReason =
    top.urgency === "Urgent"
      ? "Highest urgency"
      : top.horizon !== null
        ? "Earliest deadline"
        : "First listed action";

  return {
    nextStep: top.action,
    nextStepReason,
    nextStepActionIndex: top.index,
  };
}

/* =========================================================
   TEXT CLEANING AND NORMALIZATION (ENHANCED)
 ========================================================= */
export function cleanText(text: string): string {
  return text
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    // Strip non-printable control chars but KEEP accented Latin letters and
    // Latin-1 punctuation (ñ, á, é, ß, ø, œ, …) so non-English input and OCR
    // text aren't silently corrupted.
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u024F]/g, "")
    .replace(/office of the municipal mayor.*?(?=re\s*:)/gi, "")
    .replace(/local government unit.*?(?=office)/gi, "")
    .replace(/email:.*?\s/gi, "")
    .replace(/s&f office memorandum no\..*?series of \d{4}/gi, "")
    .replace(/\b[A-Z]{2,}\s*&\s*[A-Z]{2,}\b/g, "")
    .trim();
}

/* =========================================================
   INPUT ENHANCEMENT FOR MESSY TEXT
 ========================================================= */
export function enhanceInput(input: string): string {  let enhanced = input;
  
  // Fix common OCR errors. Single-letter substitutions are intentionally
  // omitted: rewriting a standalone "u"/"r" corrupts initials and names
  // ("R. Santos", building "U").
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
    'ur': 'your',
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

  // NOTE: we intentionally do NOT append an instruction prompt here. Earlier
  // versions appended "…(Please analyze this brief message…)" to short inputs,
  // and the rule engine then extracted that prompt text as an "action" /
  // deadline (BUG-09, prompt leakage). The rule engine works fine on short
  // inputs without it.

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
    
    if (!isLostItemSentence && !isFoundInstruction && ACTION_LEXICON.some(v => lower.includes(v))) {
      actions.push(extractActionPhrase(sentence));
    } else if (isFoundInstruction && !actions.some(a => a.toLowerCase().includes("lost and found"))) {
      actions.push("If you find the item, bring it to the Lost and Found office");
    }

    const deadlineMatch = sentence.match(DEADLINE_REGEX);
    if (deadlineMatch) deadlines.push(deadlineMatch[0]);

    const confusing = detectConfusingPart(sentence);
    if (confusing) confusingParts.push(confusing);
  }

  const lowerInput = cleaned.toLowerCase();
  const isLostItem =
    lowerInput.includes("lost") ||
    lowerInput.includes("missing") ||
    lowerInput.includes("un-possess") ||
    lowerInput.includes("not with its owner") ||
    lowerInput.includes("void in");
  const isFoundItem =
    lowerInput.includes("found") || lowerInput.includes("if you find");

  const urgencyDecision = classifyUrgency(cleaned, deadlines);
  const urgency = urgencyDecision.level;
  const urgencyReason = urgencyDecision.reason;
  const urgencyConfidence = urgencyDecision.confidence;

  const nextStepDecision = pickNextStep({
    actions,
    deadlines,
    urgency,
    isLostItem,
    isFoundItem,
  });
  const nextStep = nextStepDecision.nextStep;
  const nextStepReason = nextStepDecision.nextStepReason;
  const nextStepActionIndex = nextStepDecision.nextStepActionIndex;

  const summary = generateDecisionFocusedSummary({
    text: cleaned,
    sentences,
    actions,
    deadlines,
    urgency,
    isLostItem,
    isFoundItem,
  });

  return {
    actions: dedupeActions(actions.length ? actions : ["No clear action mentioned"]),
    deadlines: deadlines.length ? [...new Set(deadlines)] : ["No deadline mentioned"],
    urgency,
    urgencyReason,
    urgencyConfidence,
    confusingParts: dedupeConfusingParts(confusingParts),
    nextStep,
    nextStepReason,
    nextStepActionIndex,
    summary,
    analysisMethod: "fallback"
  };
}

/* =========================================================
   DOMAIN-AGNOSTIC DECISION-FOCUSED SUMMARY
   Built from the extracted structure (actions + top deadline +
   urgency), with light special-casing for lost/found items.
 ========================================================= */
function generateDecisionFocusedSummary(opts: {
  text: string;
  sentences: string[];
  actions: string[];
  deadlines: string[];
  urgency: AnalysisResult["urgency"];
  isLostItem: boolean;
  isFoundItem: boolean;
}): string {
  const { text, sentences, actions, deadlines, urgency, isLostItem, isFoundItem } = opts;
  const lowerText = text.toLowerCase();

  if (isLostItem) {
    const itemDesc = sentences.find(s => /medium-sized|rectangle|flat|wallet|card|bag/i.test(s));
    const location = sentences.find(s => /north-south corridor|bench|table|room|near/i.test(s));
    let summary = "A lost item was reported";
    if (itemDesc) summary += " (" + itemDesc.substring(0, 60) + ")";
    if (location) summary += ", last seen " + location.substring(0, 50);
    return summary;
  }

  if (isFoundItem) {
    const location = sentences.find(s => /north-south corridor|bench|table/i.test(s));
    return location
      ? "If found, contact the Lost and Found office; the item was last seen " + location.substring(0, 60)
      : "If found, contact the Lost and Found office.";
  }

  // What happened — the most decision-relevant sentence.
  const decisionSentence =
    sentences.find(s =>
      /please|must|required|should|will be|is hereby|announce|notice|inform|remind|reminder|confirm|reminder|cancel|postpone|suspend/i.test(s)
    ) ?? sentences[0];

  const parts: string[] = [];
  if (decisionSentence) parts.push(decisionSentence);

  // What to do — actions (max 2), trimmed to the actionable phrase.
  if (actions.length > 0) {
    const actionPhrases = actions.slice(0, 2).join("; ");
    parts.push(`Action needed: ${actionPhrases}.`);
  }

  // When — the first deadline.
  if (deadlines.length > 0) {
    parts.push(`Deadline: ${deadlines[0]}.`);
  } else if (urgency === "Urgent") {
    parts.push("This needs urgent attention.");
  } else if (lowerText.includes("no action")) {
    parts.push("No action is required from you.");
  }

  const seen = new Set<string>();
  const unique = parts.filter(p => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return p.length > 12;
  });

  if (unique.length === 0 && sentences.length > 0) {
    return sentences.slice(0, 2).join(" ");
  }

  // Keep it to ~3 sentences; trim overlong entries.
  return unique
    .slice(0, 3)
    .map(p => (p.length > 220 ? p.slice(0, 217) + "…" : p))
    .join(" ");
}


/* =========================================================
   SHARED HELPERS FOR THE STREAMING ROUTE
   ========================================================= */

/**
 * Runs the rule-based fallback on raw input (clean + enhance + rules).
 * Used by the streaming route when the AI provider is unavailable.
 */
export function runRuleAnalysis(input: string): AnalysisResult {
  const cleaned = cleanText(input);
  const enhanced = enhanceInput(cleaned);
  return analyzeWithRules(enhanced);
}
