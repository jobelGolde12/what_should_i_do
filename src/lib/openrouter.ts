interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    code?: string;
  };
}

interface OpenRouterStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
  }>;
  error?: { message: string; code?: string };
}

interface APIKeyStatus {
  keyIndex: number;
  error?: string;
  isExhausted?: boolean;
  isRateLimited?: boolean;
  isWorking?: boolean;
}

import { createError, getErrorMessage } from './errors';

const REQUEST_TIMEOUT_MS = 60_000;
const RETRY_COUNT = 2;
const RETRY_BASE_MS = 500;
const MAX_INPUT_CHARS = 20_000;

class OpenRouterAPI {
  private readonly API_KEYS = [
    process.env.OPENROUTER_API_KEY1,
    process.env.OPENROUTER_API_KEY2,
    process.env.OPENROUTER_API_KEY3
  ].filter(Boolean);

  private readonly BASE_URL = 'https://openrouter.ai/api/v1';
  private readonly MODEL =
    process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5';
  private readonly TEMPERATURE = Number(
    process.env.OPENROUTER_TEMPERATURE ?? 0.1
  );
  private readonly MAX_TOKENS = Number(
    process.env.OPENROUTER_MAX_TOKENS ?? 900
  );

  private keyStatuses: APIKeyStatus[] = [];

  constructor() {
    this.keyStatuses = this.API_KEYS.map((_, index) => ({ keyIndex: index }));
  }

  private isRetryableError(error: Error & { status?: number; code?: string }): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;
    
    return (
      errorMessage.includes('credit') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('exhausted') ||
      errorMessage.includes('insufficient') ||
      errorCode === 'insufficient_credits' ||
      errorCode === 'rate_limit_exceeded' ||
      error.status === 429 ||
      error.status === 402
    );
  }

  /** Transient errors (timeout/network) that warrant a same-key retry. */
  private isTransientError(error: Error & { status?: number; code?: string }): boolean {
    if (!error) return false;
    const message = error.message?.toLowerCase() || '';
    return (
      error.name === 'AbortError' ||
      error.code === 'aborted' ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      error.status === 503 ||
      error.status === 504
    );
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        const err = new Error(
          `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        );
        err.name = 'AbortError';
        throw err;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        if (!this.isTransientError(error as Error & { status?: number; code?: string })) {
          throw error;
        }
        if (attempt < RETRY_COUNT) {
          const delay =
            RETRY_BASE_MS * Math.pow(2, attempt) +
            Math.round(Math.random() * 100);
          console.warn(
            `OpenRouter transient error, retrying in ${delay}ms:`,
            (error as Error).message
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  private async makeRequest(messages: OpenRouterMessage[], keyIndex: number): Promise<string> {
    const apiKey = this.API_KEYS[keyIndex];
    if (!apiKey) {
      throw new Error(`API key ${keyIndex + 1} is not configured`);
    }

    try {
      const response = await this.fetchWithTimeout(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'TaskMind - Text Analysis',
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages,
          temperature: this.TEMPERATURE,
          max_tokens: this.MAX_TOKENS,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
        (error as Error & { status?: number; code?: string }).status = response.status;
        (error as Error & { status?: number; code?: string }).code = errorData.error?.code;
        throw error;
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Empty response from OpenRouter');
      }

      this.keyStatuses[keyIndex] = {
        keyIndex,
        isWorking: true,
      };

      return data.choices[0].message.content;

    } catch (error: unknown) {
      if (this.isRetryableError(error as Error & { status?: number; code?: string })) {
        const errorObj = error as Error;
        this.keyStatuses[keyIndex] = {
          keyIndex,
          error: errorObj.message,
          isExhausted: errorObj.message?.toLowerCase().includes('credit') || errorObj.message?.toLowerCase().includes('quota'),
          isRateLimited: errorObj.message?.toLowerCase().includes('rate limit')
        };
        console.warn(`OpenRouter API key ${keyIndex + 1} failed:`, errorObj.message);
      }
      throw error;
    }
  }

  async analyzeText(input: string): Promise<Record<string, unknown>> {
    if (this.API_KEYS.length === 0) {
      throw createError('No OpenRouter API keys configured', 'API_KEY_EXHAUSTED');
    }

    const normalizedInput = this.normalizeInput(input);
    const messages = buildAnalysisMessages(normalizedInput);

    let lastError: unknown = null;
    
    for (let attempt = 0; attempt < this.API_KEYS.length; attempt++) {
      const keyIndex = attempt;
      
      if (this.keyStatuses[keyIndex]?.isExhausted || 
          this.keyStatuses[keyIndex]?.isRateLimited) {
        continue;
      }

      try {
        const content = await this.withRetry(() =>
          this.makeRequest(messages, keyIndex)
        );
        
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw createError('Invalid JSON response from OpenRouter', 'INVALID_JSON');
        }

        return this.validateAndNormalizeResponse(parsed);
        
      } catch (error: unknown) {
        lastError = error;
        
        if (!this.isRetryableError(error as Error & { status?: number; code?: string })) {
          break;
        }
      }
    }

    this.throwIfAllKeysExhausted();
    const errorMessage = getErrorMessage(lastError);
    throw new Error(errorMessage || 'Failed to analyze text with OpenRouter');
  }

  /**
   * Streams the raw analysis JSON from OpenRouter, invoking `onChunk` with the
   * accumulated raw text as each chunk arrives. Key failover only kicks in when
   * a key fails before producing any content.
   */
  async streamRaw(
    input: string,
    onChunk: (accumulated: string) => void
  ): Promise<string> {
    if (this.API_KEYS.length === 0) {
      throw createError('No OpenRouter API keys configured', 'API_KEY_EXHAUSTED');
    }

    const normalizedInput = this.normalizeInput(input);
    const messages = buildAnalysisMessages(normalizedInput);

    let lastError: unknown = null;

    for (let attempt = 0; attempt < this.API_KEYS.length; attempt++) {
      const keyIndex = attempt;

      if (this.keyStatuses[keyIndex]?.isExhausted ||
          this.keyStatuses[keyIndex]?.isRateLimited) {
        continue;
      }

      try {
        return await this.withRetry(() =>
          this.streamFromKey(messages, keyIndex, onChunk)
        );
      } catch (error: unknown) {
        lastError = error;
        if (!this.isRetryableError(error as Error & { status?: number; code?: string })) {
          break;
        }
      }
    }

    this.throwIfAllKeysExhausted();
    const errorMessage = getErrorMessage(lastError);
    throw new Error(errorMessage || 'Failed to stream analysis from OpenRouter');
  }

  private async streamFromKey(
    messages: OpenRouterMessage[],
    keyIndex: number,
    onChunk: (accumulated: string) => void
  ): Promise<string> {
    const apiKey = this.API_KEYS[keyIndex];
    if (!apiKey) {
      throw new Error(`API key ${keyIndex + 1} is not configured`);
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'TaskMind - Text Analysis',
          },
          body: JSON.stringify({
            model: this.MODEL,
            messages,
            temperature: this.TEMPERATURE,
            max_tokens: this.MAX_TOKENS,
            stream: true,
            response_format: { type: 'json_object' },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
        (error as Error & { status?: number; code?: string }).status = response.status;
        (error as Error & { status?: number; code?: string }).code = errorData.error?.code;
        throw error;
      }

      if (!response.body) {
        throw new Error('Streaming response has no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let done = false;

      while (!done) {
        const { done: finished, value } = await reader.read();
        done = finished;
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !finished });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            done = true;
            break;
          }

          let chunk: OpenRouterStreamChunk;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }

          if (chunk.error) {
            throw new Error(chunk.error.message || "Streaming error from OpenRouter");
          }

          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            onChunk(accumulated);
          }
        }
      }

      if (!accumulated.trim()) {
        throw new Error('Empty streaming response from OpenRouter');
      }

      this.keyStatuses[keyIndex] = {
        keyIndex,
        isWorking: true,
      };

      return accumulated;

    } catch (error: unknown) {
      if (this.isRetryableError(error as Error & { status?: number; code?: string })) {
        const errorObj = error as Error;
        this.keyStatuses[keyIndex] = {
          keyIndex,
          error: errorObj.message,
          isExhausted: errorObj.message?.toLowerCase().includes('credit') || errorObj.message?.toLowerCase().includes('quota'),
          isRateLimited: errorObj.message?.toLowerCase().includes('rate limit')
        };
        console.warn(`OpenRouter API key ${keyIndex + 1} failed streaming:`, errorObj.message);
      }
      throw error;
    }
  }

  private throwIfAllKeysExhausted(): void {
    const activeKeys = this.keyStatuses.filter(status =>
      !status.isExhausted && !status.isRateLimited
    ).length;

    if (activeKeys === 0) {
      throw createError(
        'All OpenRouter API keys are exhausted or rate limited. Please try again later.',
        'ALL_KEYS_EXHAUSTED',
        true
      );
    }
  }

  private normalizeInput(input: string): string {
    const cleaned = input
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
    return cleaned.length > MAX_INPUT_CHARS
      ? cleaned.slice(0, MAX_INPUT_CHARS)
      : cleaned;
  }

  private validateAndNormalizeResponse(response: Record<string, unknown>): Record<string, unknown> {
    const summary = typeof response.summary === "string" ? response.summary : "";
    
    if (!summary || summary.length < 10) {
      console.warn("OpenRouter response missing or has weak summary, will use fallback summary logic");
    }

    const stringList = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [];

    return {
      actions: stringList(response.actions),
      deadlines: stringList(response.deadlines),
      urgency: ["Urgent", "Important", "Informational"].includes(response.urgency as string)
        ? response.urgency
        : "Informational",
      urgencyReason:
        typeof response.urgencyReason === "string"
          ? response.urgencyReason
          : undefined,
      urgencyConfidence:
        typeof response.urgencyConfidence === "number"
          ? response.urgencyConfidence
          : undefined,
      confusingParts: Array.isArray(response.confusingParts) ? response.confusingParts : [],
      nextStep: typeof response.nextStep === "string" ? response.nextStep : "No action specified",
      nextStepReason:
        typeof response.nextStepReason === "string"
          ? response.nextStepReason
          : undefined,
      nextStepActionIndex:
        typeof response.nextStepActionIndex === "number" &&
        Number.isInteger(response.nextStepActionIndex) &&
        response.nextStepActionIndex >= 0
          ? response.nextStepActionIndex
          : undefined,
      summary: summary || ""
    };
  }

  getKeyStatuses(): APIKeyStatus[] {
    return [...this.keyStatuses];
  }

  resetKeyStatuses(): void {
    this.keyStatuses = this.API_KEYS.map((_, index) => ({ keyIndex: index }));
  }
}

function buildAnalysisMessages(input: string): OpenRouterMessage[] {
  const systemPrompt = `You analyze any type of message - official announcements, lost & found notices, meeting invitations, instructions, or confusing communications.

Your task is to extract key information and provide a clear summary:
1. Identify the TYPE of message (announcement, lost item, meeting, instruction, etc.)
2. Interpret the intent even if the message is humorous, vague, or poorly written
3. Extract actionable items regardless of how they're phrased
4. Identify deadlines, times, and dates
5. Determine urgency appropriately - lost items are NOT urgent unless stated
6. Summarize what happened and what action to take (if any)

Return ONLY valid JSON with these exact fields:
{
  "actions": ["array of specific actions required - empty if none"],
  "deadlines": ["array of deadlines or timeframes - empty if none"],
  "urgency": "Urgent" | "Important" | "Informational",
  "urgencyReason": "short reason for the urgency level (e.g. 'Deadline within 24h')",
  "confusingParts": [{"sentence": "confusing text", "explanation": "why it's confusing", "reason": "missing-info|ambiguity|contradiction|jargon|incomplete", "suggestion": "what to clarify", "severity": "low|medium|high"}],
  "nextStep": "clear next action statement or 'No action required' if none — must be one of the actions when one exists",
  "nextStepReason": "one sentence explaining why this step is prioritized",
  "nextStepActionIndex": "index into the actions array of the recommended step, or null",
  "summary": "2-3 sentence concise summary that answers: What happened? What should I do? When?"
}

CRITICAL RULES FOR URGENCY:
- Lost item notices = "Informational" (not urgent)
- Meeting invitations = "Informational" or "Important"
- Only "Urgent" for actual emergencies, deadlines within 24h, safety alerts
- Default to "Informational" if unclear

The summary is MANDATORY and must be:
- Concise (under 100 characters if possible)
- Decision-focused (answers what action to take)
- Free of headers, bullet points, or formatting
- In plain sentences, not lists`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analyze this message: "${input}"` }
  ];
}

export { buildAnalysisMessages };

export const openRouterAPI = new OpenRouterAPI();