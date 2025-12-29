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
};

const ACTION_VERBS = [
  "submit", "attend", "pay", "respond", "bring",
  "fill out", "register", "watch", "send", "reply"
];

const URGENT_KEYWORDS = ["today", "immediately", "asap", "urgent", "final notice"];
const DEADLINE_REGEX =
  /(today|tomorrow|before\s+\w+|by\s+\w+|on\s+\w+\s+\d{1,2}|end of week)/i;

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

    // Action extraction
    if (ACTION_VERBS.some(v => lower.includes(v))) {
      actions.push(sentence);
    }

    // Deadline detection
    const deadlineMatch = sentence.match(DEADLINE_REGEX);
    if (deadlineMatch) {
      deadlines.push(deadlineMatch[0]);
    }

    // Confusion detection
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

  // Urgency classification
  let urgency: AnalysisResult["urgency"] = "Informational";

  if (URGENT_KEYWORDS.some(k => input.toLowerCase().includes(k))) {
    urgency = "Urgent";
  } else if (deadlines.length > 0) {
    urgency = "Important";
  }

  // Next step logic (priority-based)
  let nextStep = "No immediate action required.";

  if (actions.length > 0) {
    nextStep = `Your next step is to ${actions[0].toLowerCase()}.`;
  }

  return {
    actions: actions.length ? actions : ["No clear action mentioned"],
    deadlines: deadlines.length ? deadlines : ["No deadline mentioned"],
    urgency,
    confusingParts,
    nextStep
  };
}
