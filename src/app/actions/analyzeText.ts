"use server";

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

const ACTION_VERBS = [
  "submit", "attend", "pay", "respond", "bring",
  "fill out", "register", "watch", "send", "reply"
];

const URGENT_KEYWORDS = ["today", "immediately", "asap", "urgent", "final notice"];

const DEADLINE_REGEX =
  /(today|tomorrow|before\s+\w+|by\s+\w+|on\s+\w+\s+\d{1,2}|end of week)/i;

/* =========================================================
   TEXT CLEANING (UNCHANGED)
========================================================= */
function cleanText(text: string): string {
  return text
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/* =========================================================
   SUMMARIZER (UNCHANGED LOGIC)
========================================================= */
function summarizeText(text: string): string {
  const cleaned = cleanText(text);

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const IMPORTANT_KEYWORDS = [
    "suspension",
    "suspended",
    "is hereby declared",
    "effective",
    "until lifted",
    "face-to-face",
    "classes",
  ];

  const DATE_KEYWORDS = [
    "november",
    "december",
    "january",
    "2025",
    "effective",
    "today",
    "tomorrow",
  ];

  const scored = sentences.map(sentence => {
    let score = 0;
    const lower = sentence.toLowerCase();

    IMPORTANT_KEYWORDS.forEach(k => {
      if (lower.includes(k)) score += 3;
    });

    DATE_KEYWORDS.forEach(k => {
      if (lower.includes(k)) score += 1;
    });

    if (sentence.length > 40 && sentence.length < 300) score += 1;

    return { sentence, score };
  });

  const best = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(s => s.sentence);

  return best.join(" ");
}

/* =========================================================
   HIGHLIGHT IMPORTANT PHRASES (NEW)
========================================================= */
function highlightImportantPhrases(text: string): string {
  // Extended list of phrases commonly found in emails, messages, announcements
  const PHRASES_TO_HIGHLIGHT = [
    "suspension of face-to-face classes",
    "both public and private schools",
    "municipality of bulan, sorsogon",
    "face-to-face classes",
    "all levels",
    "effective",
    "until lifted",
    "please be advised",
    "urgent",
    "important",
    "as soon as possible",
    "deadline",
    "immediately",
    "action required",
    "notice",
    "announcement",
    "for your guidance",
    "for immediate compliance",
    "stay safe",
    "kindly",
    "thank you",
    "regards",
    "sincerely",
    "best wishes",
    "looking forward",
    "should you have any questions",
    "do not hesitate to",
    "feel free to",
    "contact us",
    "reach out",
    "take care",
    "warm regards",
    "with appreciation",
    "yours faithfully",
    "yours sincerely",
    "respectfully",
    "cordially",
    "best regards",
    "note"
  ];

  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();

  let result = "";
  let index = 0;

  while (index < text.length) {
    let matched = false;

    for (const phrase of PHRASES_TO_HIGHLIGHT) {
      const phraseLen = phrase.length;

      // Check if the current substring matches (case-insensitive)
      if (lowerText.startsWith(phrase.toLowerCase(), index)) {
        // Modernistic highlight with gradient, rounded edges, and subtle padding
        result += `<mark style="background: linear-gradient(90deg, #FDE68A, #FBBF24); padding: 0.1em 0.3em; border-radius: 0.25rem; font-weight: 500;">${text.substr(index, phraseLen)}</mark>`;
        index += phraseLen;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += text[index];
      index += 1;
    }
  }

  return result;
}



/* =========================================================
   MAIN ANALYSIS FUNCTION
========================================================= */
export async function analyzeText(input: string): Promise<AnalysisResult> {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const actions: string[] = [];
  const deadlines: string[] = [];
  const confusingParts: AnalysisResult["confusingParts"] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (ACTION_VERBS.some(v => lower.includes(v))) {
      actions.push(sentence);
    }

    const deadlineMatch = sentence.match(DEADLINE_REGEX);
    if (deadlineMatch) {
      deadlines.push(deadlineMatch[0]);
    }

    if (
      sentence.length > 120 ||
      lower.includes("as necessary") ||
      lower.includes("subject to") ||
      lower.includes("accordingly")
    ) {
      confusingParts.push({
        sentence,
        explanation:
          "This sentence is long or vague and may be difficult to understand clearly."
      });
    }
  }

  let urgency: AnalysisResult["urgency"] = "Informational";
  if (URGENT_KEYWORDS.some(k => input.toLowerCase().includes(k))) {
    urgency = "Urgent";
  } else if (deadlines.length > 0) {
    urgency = "Important";
  }

  let nextStep = "No immediate action required.";
  if (actions.length > 0) {
    nextStep = `Your next step is to ${actions[0].toLowerCase()}.`;
  }

  // ✅ Summary + Highlighting
  const summary = highlightImportantPhrases(summarizeText(input));

  return {
    actions: actions.length ? actions : ["No clear action mentioned"],
    deadlines: deadlines.length ? deadlines : ["No deadline mentioned"],
    urgency,
    confusingParts,
    nextStep,
    summary,
  };
}
