/**
 * Dev-only mock AI for free-text streaming (`AIClient.streamText`).
 *
 * Purpose: exercise the analysis-chat flow (grounded answers, topic-lock
 * refusals, streaming UI, persistence) without spending provider credits
 * or needing network access.
 *
 * Activation is intentionally loud and narrow:
 * - Requires `AI_MOCK=1` in the environment.
 * - Never active when `NODE_ENV === "production"`, even if the flag is set.
 *
 * It is a crude heuristic simulator, NOT a grounding engine: questions are
 * classified on-topic/off-topic by keyword overlap against the context that
 * `buildChatMessages` embeds in the system prompt (<message> / <analysis>),
 * and on-topic answers are assembled from the analysis fields themselves.
 */

export type MockChatMessage = {
  role: string;
  content: string;
};

export type MockStreamResult = {
  content: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

/** True only when explicitly opted in outside production. */
export function isAiMockEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AI_MOCK === "1";
}

const REFUSAL =
  "Sorry — I can only answer questions about the original message and its " +
  "analysis. Try asking about the deadline, urgency, actions, or the " +
  "confusing parts.";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","than","so","because","of","in",
  "on","at","to","for","from","by","with","about","into","over","after","before",
  "is","are","was","were","be","been","being","am","do","does","did","done",
  "have","has","had","will","would","shall","should","can","could","may","might",
  "must","i","im","me","my","we","our","us","you","your","he","she","it","its",
  "they","them","their","this","that","these","those","there","here","what",
  "which","who","whom","whose","when","where","why","how","not","no","yes",
  "please","tell","say","said","give","show","explain","mean","means","think",
]);

/** Chat-domain words that always count as on-topic for this assistant. */
const DOMAIN_KEYWORDS = [
  "deadline","due","urgency","urgent","important","priority","action","actions",
  "task","tasks","next","step","first","start","begin","summary","summarize",
  "unclear","uncertainty","confusing","confusion","jargon","reply","respond",
  "response","tone","draft","message","analysis",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Loose stem match so "deadline" hits "deadlines", "reply" hits "replies". */
function stemsIntersect(a: string[], b: string[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.startsWith(y) || y.startsWith(x)) return true;
    }
  }
  return false;
}

export function extractChatContext(messages: MockChatMessage[]): {
  originalMessage: string;
  analysis: Record<string, unknown>;
  question: string;
} {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const question =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const messageMatch = system.match(/<message>\n([\s\S]*?)\n<\/message>/);
  const analysisMatch = system.match(/<analysis>\n([\s\S]*?)\n<\/analysis>/);

  let analysis: Record<string, unknown> = {};
  if (analysisMatch) {
    try {
      analysis = JSON.parse(analysisMatch[1]) as Record<string, unknown>;
    } catch {
      /* malformed context → empty analysis */
    }
  }

  return {
    originalMessage: messageMatch?.[1]?.trim() ?? "",
    analysis,
    question,
  };
}

/**
 * On-topic iff the question touches chat-domain vocabulary OR shares a
 * meaningful token with the embedded message/analysis context.
 */
export function classifyQuestion(
  question: string,
  contextTokens: string[]
): "on-topic" | "off-topic" {
  const q = tokenize(question);
  if (q.length === 0) return "off-topic";

  if (q.some((t) => DOMAIN_KEYWORDS.some((k) => t.startsWith(k)))) {
    return "on-topic";
  }
  return stemsIntersect(q, contextTokens) ? "on-topic" : "off-topic";
}

type AnalysisShape = {
  deadlines?: unknown;
  urgency?: unknown;
  urgencyReason?: unknown;
  nextStep?: unknown;
  summary?: unknown;
  actions?: unknown;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function strList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

/** Deterministic grounded answer assembled from the provided analysis only. */
export function buildGroundedAnswer(
  question: string,
  analysis: Record<string, unknown>,
  originalMessage: string
): string {
  const a = analysis as AnalysisShape;
  const deadlines = strList(a.deadlines);
  const actions = strList(a.actions);
  const urgency = str(a.urgency);
  const urgencyReason = str(a.urgencyReason);
  const nextStep = str(a.nextStep);
  const lines: string[] = [];

  const q = question.toLowerCase();
  const wants = (...keys: string[]) => keys.some((k) => q.includes(k));

  if (deadlines.length > 0 && (wants("deadline", "due", "when") || lines.length === 0)) {
    lines.push(`The message sets ${deadlines.length > 1 ? "deadlines" : "a deadline"}: ${deadlines.join(", ")}.`);
  }

  if (urgency && (wants("urgent", "priority", "importan") || lines.length === 0)) {
    lines.push(
      urgencyReason
        ? `It reads as ${urgency.toLowerCase()} — ${urgencyReason.replace(/\.$/, "")}.`
        : `It reads as ${urgency.toLowerCase()}.`
    );
  }

  if (wants("action", "task", "do") && actions.length > 0) {
    lines.push(`Actions identified: ${actions.join("; ")}.`);
  }

  if (nextStep && (wants("next", "first", "start", "step") || lines.length === 0)) {
    lines.push(`Suggested next step: ${nextStep}.`);
  }

  if (lines.length === 0) {
    const firstSentence =
      originalMessage.split(/(?<=[.!?])\s/)[0] ?? originalMessage;
    lines.push(
      `Based on the original message — "${firstSentence.trim()}" — the analysis breaks it down into concrete actions, deadlines, and urgency. Ask about any of those for detail.`
    );
  }

  return lines.slice(0, 3).join(" ");
}

export async function mockStreamText(
  messages: MockChatMessage[],
  onDelta: (accumulated: string) => void,
  opts: { delayMs?: number } = {}
): Promise<MockStreamResult> {
  const { originalMessage, analysis, question } =
    extractChatContext(messages);

  const contextTokens = tokenize(`${originalMessage} ${JSON.stringify(analysis)}`);
  const verdict = classifyQuestion(question, contextTokens);
  const content =
    verdict === "on-topic"
      ? buildGroundedAnswer(question, analysis, originalMessage)
      : REFUSAL;

  // Stream word-by-word so the client UI renders genuine incremental deltas.
  const delayMs = opts.delayMs ?? Number(process.env.AI_MOCK_DELAY_MS ?? 20);
  const chunks = content.match(/\S+\s*/g) ?? [content];
  let accumulated = "";
  for (const chunk of chunks) {
    accumulated += chunk;
    onDelta(accumulated);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const promptTokens = Math.ceil(
    messages.reduce((n, m) => n + m.content.length, 0) / 4
  );
  const completionTokens = Math.ceil(content.length / 4);

  return {
    content,
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}
