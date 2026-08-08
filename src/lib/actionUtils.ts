/* =========================================================
   Shared action utilities — used by the rule fallback and the
   results UI (no server-only dependencies).
   ========================================================= */

/** English + Filipino action verb lexicon (colloquial included). */
export const ACTION_LEXICON = [
  // English
  "submit", "attend", "pay", "respond", "bring", "fill out", "register",
  "watch", "send", "reply", "provide", "complete", "contact", "visit",
  "call", "email", "coordinate", "prepare", "review", "sign", "return",
  "confirm", "notify", "inform", "deliver", "schedule", "update",
  "follow up", "resubmit", "enroll", "claim", "pick up", "upload",
  "print", "share", "join", "turn in", "hand in", "check", "verify",
  "buy", "order", "apply", "add", "read", "download", "save", "vote",
  // Filipino
  "isumite", "magsumite", "dumalo", "magbayad", "magpadala", "sagutin",
  "sumagot", "magbigay", "makipag-ugnay", "makipag-ugnayan", "pumunta",
  "tumawag", "dalhin", "kumpletuhin", "mag-email", "mag-apply", "ipasa",
  "mag-confirm", "magpasa", "ipagbigay-alam", "mag-notify", "magtawag",
  "i-submit", "magpaalam", "magbayad ng", "bisitahin",
];

export type ActionCategory =
  | "attend"
  | "pay"
  | "submit"
  | "communicate"
  | "document"
  | "other";

const CATEGORY_KEYWORDS: Record<Exclude<ActionCategory, "other">, string[]> = {
  attend: ["attend", "show up", "join", "be present", "dumalo", "pumunta", "appear"],
  pay: ["pay", "payment", "settle", "magbayad", "bayad", "remit"],
  submit: [
    "submit", "upload", "turn in", "hand in", "file", "ipasa", "isumite",
    "magsumite", "i-submit", "magpasa", "fill out", "enroll", "register", "apply",
  ],
  communicate: [
    "reply", "respond", "email", "call", "contact", "message", "notify",
    "confirm", "sagutin", "sumagot", "tumawag", "makipag-ugnay", "mag-email",
    "inform", "answer", "follow up",
  ],
  document: [
    "prepare", "review", "sign", "print", "bring", "provide", "compile",
    "attach", "summarize", "read", "download", "save", "check", "verify",
    "update", "schedule", "deliver", "coordinate", "dalhin",
  ],
};

/** Maps an action phrase to a coarse category (for display/triage). */
export function categorizeAction(action: string): ActionCategory {
  const lower = action.toLowerCase();
  for (const category of Object.keys(CATEGORY_KEYWORDS) as Exclude<
    ActionCategory,
    "other"
  >[]) {
    if (CATEGORY_KEYWORDS[category].some((k) => lower.includes(k))) {
      return category;
    }
  }
  return "other";
}

function cap(text: string): string {
  const t = text.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Removes markdown/bullet/numbering cruft from an action string. */
export function cleanActionText(action: string): string {
  return cap(
    action
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/[`"]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/, "")
  );
}

/**
 * Extracts the actionable verb phrase from a sentence instead of returning the
 * whole sentence: "Please submit the final project by Friday" → "Submit the
 * final project by Friday". Splits compound sentences ("submit X and attend Y")
 * at the second action verb.
 */
export function extractActionPhrase(sentence: string): string {
  let text = sentence
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "");

  // Strip leading politeness / second-person fillers.
  text = text
    .replace(/^please\s+/i, "")
    .replace(/^kindly\s+/i, "")
    .replace(
      /^(we|i|you|they|everyone|all)\s+(must|should|need to|have to|will|are asked to|are requested to|are required to|are encouraged to)\s+/i,
      ""
    )
    .replace(/^you\s+/i, "")
    .replace(/^please\s+/i, "");

  const lower = text.toLowerCase();

  // Find the earliest lexicon verb occurrence.
  let best = -1;
  for (const verb of ACTION_LEXICON) {
    const idx = lower.indexOf(verb);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
    }
  }

  if (best === -1) return cap(text);

  let phrase = text.slice(best).trim();

  // Split compound clauses that start a second action ("submit X and attend Y").
  const clauseCut = phrase.search(/\s+(?:and|also|then|as well as)\s+|\s+;\s+/);
  if (clauseCut !== -1) {
    const rest = phrase.slice(clauseCut);
    if (ACTION_LEXICON.some((v) => rest.toLowerCase().includes(v))) {
      phrase = phrase.slice(0, clauseCut);
    }
  }

  // Cap length at a word boundary (keeps the phrase scannable).
  if (phrase.length > 110) {
    const idx = phrase.lastIndexOf(" ", 110);
    phrase = phrase.slice(0, idx > 40 ? idx : 110);
  }

  return cap(phrase.replace(/[.,;:]+$/, "").trim());
}

/**
 * Removes duplicate / near-duplicate actions using a normalized key of the
 * first several words. Preserves first-seen order.
 */
export function dedupeActions(actions: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of actions) {
    const cleaned = cleanActionText(raw);
    if (!cleaned) continue;
    const norm = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!norm) continue;
    const key = norm.split(" ").slice(0, 6).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}
