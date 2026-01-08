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

const DEADLINE_REGEX = /(today|tomorrow|before\s+\w+|by\s+\w+|on\s+\w+\s+\d{1,2}|end of week)/i;

/* =========================================================
   TEXT CLEANING
========================================================= */
function cleanText(text: string): string {
  return text
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/* =========================================================
   DEEPSEEK AI ANALYSIS - PRIMARY METHOD
========================================================= */
async function analyzeWithDeepSeek(input: string): Promise<AnalysisResult> {
  const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key is not configured");
  }

  const systemPrompt = `You are an assistant that analyzes announcements and extracts structured information.
  
  Analyze the announcement and return a JSON object with EXACTLY these fields:
  
  1. actions: array of strings - specific actions people need to take
  2. deadlines: array of strings - any deadlines or timeframes mentioned
  3. urgency: string - one of: "Urgent", "Important", "Informational"
  4. confusingParts: array of objects with {sentence: string, explanation: string}
  5. nextStep: string - recommended immediate next action
  6. summary: string - concise 2-3 sentence summary
  
  Guidelines:
  - Extract clear, actionable items
  - Look for dates, times, and deadlines
  - Determine urgency based on time sensitivity and keywords
  - Identify confusing sentences (long, complex, or vague)
  - Provide a clear, concise summary
  - Format the summary in plain text (no markdown)
  
  Example response format:
  {
    "actions": ["Submit the report by Friday", "Attend the meeting at 3 PM"],
    "deadlines": ["Friday", "by end of week"],
    "urgency": "Important",
    "confusingParts": [
      {
        "sentence": "The submission should be made in accordance with the aforementioned guidelines.",
        "explanation": "Vague about which specific guidelines to follow"
      }
    ],
    "nextStep": "Submit the report by Friday",
    "summary": "This announcement requires submitting a report by Friday and attending a meeting. The submission must follow specific guidelines."
  }`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from DeepSeek API");
    }
    
    const result = JSON.parse(data.choices[0].message.content);
    
    // Validate and apply highlighting to the summary
    const validatedResult: AnalysisResult = {
      actions: Array.isArray(result.actions) ? result.actions : [],
      deadlines: Array.isArray(result.deadlines) ? result.deadlines : [],
      urgency: ["Urgent", "Important", "Informational"].includes(result.urgency) 
        ? result.urgency 
        : "Informational",
      confusingParts: Array.isArray(result.confusingParts) ? result.confusingParts : [],
      nextStep: typeof result.nextStep === 'string' ? result.nextStep : "No action specified",
      summary: highlightImportantPhrases(typeof result.summary === 'string' ? result.summary : "")
    };
    
    return validatedResult;
    
  } catch (error) {
    console.error("DeepSeek analysis failed:", error);
    throw error; // Re-throw to be caught by fallback
  }
}

/* =========================================================
   RULE-BASED FALLBACK ANALYSIS
========================================================= */
function analyzeWithRules(input: string): AnalysisResult {
  const cleaned = cleanText(input);
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  const actions: string[] = [];
  const deadlines: string[] = [];
  const confusingParts: AnalysisResult["confusingParts"] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    
    // Extract actions
    if (ACTION_VERBS.some(v => lower.includes(v))) {
      actions.push(sentence);
    }
    
    // Extract deadlines
    const deadlineMatch = sentence.match(DEADLINE_REGEX);
    if (deadlineMatch) {
      deadlines.push(deadlineMatch[0]);
    }
    
    // Identify confusing parts
    if (sentence.length > 120 || 
        lower.includes("as necessary") || 
        lower.includes("subject to") || 
        lower.includes("accordingly")) {
      confusingParts.push({
        sentence,
        explanation: "This sentence is long or vague and may be difficult to understand clearly."
      });
    }
  }

  // Determine urgency
  let urgency: AnalysisResult["urgency"] = "Informational";
  const lowerInput = input.toLowerCase();
  if (URGENT_KEYWORDS.some(k => lowerInput.includes(k))) {
    urgency = "Urgent";
  } else if (deadlines.length > 0) {
    urgency = "Important";
  }

  // Determine next step
  let nextStep = "No immediate action required.";
  if (actions.length > 0) {
    nextStep = `Your next step is to ${actions[0].toLowerCase()}.`;
  }

  // Generate summary using rule-based method
  const summary = generateRuleBasedSummary(input);

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
   RULE-BASED SUMMARY GENERATION
========================================================= */
function generateRuleBasedSummary(text: string): string {
  const cleaned = cleanText(text);
  
  // For very short text, return as-is
  if (cleaned.length < 150) {
    return cleaned;
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  // Keywords that indicate important information
  const IMPORTANT_KEYWORDS = [
    "suspension", "suspended", "is hereby declared", "effective", 
    "until lifted", "face-to-face", "classes", "deadline",
    "urgent", "important", "must", "required", "submit"
  ];

  // Score sentences based on importance
  const scored = sentences.map(sentence => {
    let score = 0;
    const lower = sentence.toLowerCase();

    IMPORTANT_KEYWORDS.forEach(k => { 
      if (lower.includes(k)) score += 3; 
    });

    // Prioritize sentences with dates/deadlines
    if (sentence.match(DEADLINE_REGEX)) score += 2;
    
    // Prioritize sentences with action verbs
    if (ACTION_VERBS.some(v => lower.includes(v))) score += 2;
    
    // Moderate length sentences are often more informative
    if (sentence.length > 30 && sentence.length < 200) score += 1;

    return { sentence, score };
  });

  // Select top 2-3 sentences
  const best = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.sentence);

  return best.length > 0 ? best.join(" ") : sentences.slice(0, 2).join(" ");
}

/* =========================================================
   HIGHLIGHT IMPORTANT PHRASES
========================================================= */
function highlightImportantPhrases(text: string): string {
  const PHRASES_TO_HIGHLIGHT = [
    "suspension of face-to-face classes", "both public and private schools",
    "municipality of bulan, sorsogon", "face-to-face classes", "all levels",
    "effective", "until lifted", "please be advised", "urgent", "important",
    "as soon as possible", "deadline", "immediately", "action required",
    "notice", "announcement", "for your guidance", "for immediate compliance",
    "submit", "attend", "pay", "respond", "bring", "register", "today",
    "tomorrow", "final notice", "required", "must", "mandatory"
  ];

  // Sort by length (longest first) to avoid partial matches
  const sortedPhrases = [...PHRASES_TO_HIGHLIGHT].sort((a, b) => b.length - a.length);
  const lowerText = text.toLowerCase();
  let result = "";
  let index = 0;

  while (index < text.length) {
    let matched = false;
    
    for (const phrase of sortedPhrases) {
      const phraseLower = phrase.toLowerCase();
      
      if (lowerText.startsWith(phraseLower, index)) {
        // Highlight the phrase
        result += `<mark style="background: linear-gradient(90deg, #FDE68A, #FBBF24); padding: 0.1em 0.3em; border-radius: 0.25rem; font-weight: 500;">${text.substr(index, phrase.length)}</mark>`;
        index += phrase.length;
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
   MAIN ANALYSIS FUNCTION WITH SMART FALLBACK
========================================================= */
export async function analyzeText(input: string): Promise<AnalysisResult> {
  // Clean input first
  const cleanedInput = cleanText(input);
  
  if (cleanedInput.length < 10) {
    throw new Error("Text is too short to analyze");
  }

  // Strategy: Use DeepSeek for longer/complex texts, rules for short/simple ones
  if (shouldUseDeepSeek(cleanedInput)) {
    try {
      // Add timeout for DeepSeek API call
      const timeoutPromise = new Promise<AnalysisResult>((_, reject) => {
        setTimeout(() => reject(new Error("DeepSeek API timeout")), 15000); // 15 second timeout
      });

      const deepSeekPromise = analyzeWithDeepSeek(cleanedInput);
      const result = await Promise.race([deepSeekPromise, timeoutPromise]);
      
      // Validate DeepSeek returned a proper result
      if (isValidResult(result)) {
        return result;
      }
    } catch (error) {
      console.log("DeepSeek failed, falling back to rule-based:", error);
      // Continue to rule-based fallback
    }
  }

  // Use rule-based analysis (always works)
  return analyzeWithRules(cleanedInput);
}

/* =========================================================
   HELPER FUNCTIONS
========================================================= */
function shouldUseDeepSeek(text: string): boolean {
  // Use DeepSeek for longer, more complex texts
  const sentences = text.split(/[.!?]+/).length;
  const words = text.split(/\s+/).length;
  
  return (
    text.length > 200 ||    // Longer texts
    sentences > 3 ||        // Multiple sentences
    words > 50 ||           // More words
    text.includes("urgent") || // Contains urgency indicators
    text.includes("deadline") ||
    text.includes("required") ||
    text.includes("must")
  );
}

function isValidResult(result: any): result is AnalysisResult {
  return (
    result &&
    typeof result === 'object' &&
    Array.isArray(result.actions) &&
    Array.isArray(result.deadlines) &&
    ['Urgent', 'Important', 'Informational'].includes(result.urgency) &&
    typeof result.nextStep === 'string' &&
    typeof result.summary === 'string'
  );
}

/* =========================================================
   FAST ANALYSIS (RULE-BASED ONLY) FOR INSTANT RESPONSE
========================================================= */
export async function analyzeTextFast(input: string): Promise<AnalysisResult> {
  const cleaned = cleanText(input);
  return analyzeWithRules(cleaned);
}

/* =========================================================
   BATCH ANALYSIS FOR MULTIPLE TEXTS
========================================================= */
export async function analyzeTextsBatch(texts: string[]): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  
  for (const text of texts) {
    if (text.trim().length > 0) {
      try {
        const result = await analyzeText(text);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze text: ${error}`);
        // Add a default result for failed analyses
        results.push(analyzeWithRules(text));
      }
    }
  }
  
  return results;
}

/* =========================================================
   VALIDATE DEEPSEEK API CONNECTION
========================================================= */
export async function validateDeepSeekConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      message: "DeepSeek API key is not configured in environment variables"
    };
  }

  try {
    const response = await fetch("https://api.deepseek.com/models", {
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: "DeepSeek API connection successful"
      };
    } else {
      return {
        success: false,
        message: `DeepSeek API connection failed: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `DeepSeek API connection error: ${error}`
    };
  }
}