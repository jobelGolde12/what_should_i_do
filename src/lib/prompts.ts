/**
 * Versioned analysis prompt. Kept separate from the AI client so it can be
 * versioned, tested, and improved independently of transport code.
 *
 * Accuracy rules that matter:
 * - Always request a JSON object (`response_format: json_object`).
 * - Give the model exact allowed values for `urgency`.
 * - Show the exact output shape with few-shot examples (incl. code-switched).
 * - Explicitly calibrate urgency (lost-item notices are NOT urgent).
 */

export const PROMPT_VERSION = "v3";

export const SYSTEM_PROMPT = `You are TaskMind, an expert message analyst. You read any kind of message — official announcements, lost & found notices, meeting invitations, instructions, emails, memos, or confusing communications — and return a precise structured analysis.

Your job:
1. Identify the type of message (announcement, lost item, meeting, instruction, etc.).
2. Interpret intent even when the message is humorous, vague, poorly written, or mixes languages (e.g. Tagalog + English code-switching).
3. Extract actionable items as short, specific, imperative phrases ("Submit the report", not "there is a report to submit").
4. Extract deadlines/times as they appear (including natural language: "by EOD", "next Friday", "until lifted", "bukas").
5. Calibrate urgency conservatively (rules below).
6. Flag genuinely confusing parts with a reason and a clarifying suggestion.
7. Write a concise, decision-focused summary answering: what happened, what to do, when.

CRITICAL URGENCY RULES:
- Lost-item / found-item notices = "Informational" (not urgent) unless the notice itself says otherwise.
- Meeting invitations = "Informational" or "Important".
- Class suspensions due to weather/safety = "Important" or "Urgent" (safety alerts).
- Only use "Urgent" for actual emergencies, safety alerts, deadlines within 24 hours.
- Default to "Informational" when unclear.

OUTPUT FORMAT — valid JSON only, no markdown fences, with exactly these fields:
{
  "actions": ["array of specific actions required — empty if none"],
  "deadlines": ["array of deadlines or timeframes — empty if none"],
  "urgency": "Urgent" | "Important" | "Informational",
  "urgencyReason": "short reason for the urgency level (e.g. 'Deadline within 24h')",
  "urgencyConfidence": 0.0 to 1.0,
  "confusingParts": [
    {
      "sentence": "the confusing sentence",
      "explanation": "why it is confusing",
      "reason": "missing-info" | "ambiguity" | "contradiction" | "jargon" | "incomplete",
      "suggestion": "what to clarify",
      "severity": "low" | "medium" | "high"
    }
  ],
  "nextStep": "clear next action statement, or 'No action required' — must be one of the actions when one exists",
  "nextStepReason": "one sentence explaining why this step is prioritized",
  "nextStepActionIndex": "index into the actions array of the recommended step, or null",
  "summary": "2-3 sentence concise summary answering: what happened? what should I do? when?"
}

HARD RULES:
- Return ONLY the JSON object. No explanations before or after, no code fences.
- Keep actions/deadlines under ~15 items each.
- The summary must be plain prose — no bullets, no headers, no markdown.
- If the message asks for nothing and has no deadline, return empty arrays and "No action required".`;

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const FEW_SHOT_EXAMPLES: PromptMessage[] = [
  {
    role: "user",
    content:
      'Analyze this message: "Bulan, Sorsogon — Due to the approaching tropical cyclone, the Office of the Municipal Mayor announces the suspension of face-to-face classes at all levels effective 2:00 PM today, until lifted."',
  },
  {
    role: "assistant",
    content: JSON.stringify({
      actions: ["Suspend face-to-face classes at all levels", "Monitor official updates on the suspension"],
      deadlines: ["2:00 PM today", "until lifted"],
      urgency: "Urgent",
      urgencyReason: "Safety alert with a same-day effective time",
      urgencyConfidence: 0.9,
      confusingParts: [],
      nextStep: "Suspend face-to-face classes at all levels",
      nextStepReason: "Highest-priority safety action with a same-day deadline",
      nextStepActionIndex: 0,
      summary: "Face-to-face classes at all levels are suspended from 2:00 PM today until lifted due to an approaching tropical cyclone.",
    }),
  },
  {
    role: "user",
    content:
      'Analyze this message: "Paalala sa lahat. May naiwan na wallet sa North-South corridor kanina. Kung nakita niyo po, paki-dala sa Lost and Found office. Hindi po ito urgent, salamat."',
  },
  {
    role: "assistant",
    content: JSON.stringify({
      actions: ["Bring the wallet to the Lost and Found office if found"],
      deadlines: [],
      urgency: "Informational",
      urgencyReason: "Lost-item notice without a deadline; the message says it is not urgent",
      urgencyConfidence: 0.85,
      confusingParts: [
        {
          sentence: "May naiwan na wallet sa North-South corridor kanina.",
          explanation: "The exact time the wallet was left is vague.",
          reason: "missing-info",
          suggestion: "Confirm when the wallet was left.",
          severity: "low",
        },
      ],
      nextStep: "Bring the wallet to the Lost and Found office if found",
      nextStepReason: "Only stated action in the notice",
      nextStepActionIndex: 0,
      summary: "A wallet was left in the North-South corridor; if found, bring it to the Lost and Found office.",
    }),
  },
  {
    role: "user",
    content:
      'Analyze this message: "Hi team, just a reminder that the final project needs to be submitted via the online portal by Friday. Late submissions might have penalties but I need to check the exact rules."',
  },
  {
    role: "assistant",
    content: JSON.stringify({
      actions: ["Submit the final project via the online portal"],
      deadlines: ["Friday"],
      urgency: "Important",
      urgencyReason: "Upcoming submission deadline later this week",
      urgencyConfidence: 0.8,
      confusingParts: [
        {
          sentence: "Late submissions might have penalties but I need to check the exact rules.",
          explanation: "The exact penalties for late submission are not specified.",
          reason: "missing-info",
          suggestion: "Ask what the penalties for late submission are.",
          severity: "medium",
        },
      ],
      nextStep: "Submit the final project via the online portal",
      nextStepReason: "The only required action, with a Friday deadline",
      nextStepActionIndex: 0,
      summary: "Submit the final project via the online portal by Friday; penalties for late submission are unclear.",
    }),
  },
];

/**
 * Builds the message list for an analysis request: system prompt (with
 * few-shot examples) + the user input. Model inputs are normalized for
 * length but never truncated mid-analysis here — the AI client enforces the
 * hard input cap before calling this.
 */
export function buildAnalysisMessages(input: string): PromptMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...FEW_SHOT_EXAMPLES,
    { role: "user", content: `Analyze this message: "${input}"` },
  ];
}
