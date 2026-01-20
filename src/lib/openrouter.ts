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

interface APIKeyStatus {
  keyIndex: number;
  error?: string;
  isExhausted?: boolean;
  isRateLimited?: boolean;
}

import { createError, getErrorMessage } from './errors';

class OpenRouterAPI {
  private readonly API_KEYS = [
    process.env.OPENROUTER_API_KEY1,
    process.env.OPENROUTER_API_KEY2,
    process.env.OPENROUTER_API_KEY3
  ].filter(Boolean);

  private readonly BASE_URL = 'https://openrouter.ai/api/v1';
  private readonly MODEL = 'anthropic/claude-3.5-sonnet';

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

  private async makeRequest(messages: OpenRouterMessage[], keyIndex: number): Promise<string> {
    const apiKey = this.API_KEYS[keyIndex];
    if (!apiKey) {
      throw new Error(`API key ${keyIndex + 1} is not configured`);
    }

    try {
      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'What Should I Do - Text Analysis',
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages,
          temperature: 0.1,
          max_tokens: 900,
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
    
    const systemPrompt = `You analyze official government announcements and confusing messages.

Your task:
1. Interpret messy, incomplete, or poorly structured input
2. Handle ambiguous, confusing, or mixed-intent messages
3. Work with grammar issues, shorthand, or informal language
4. Normalize and restructure into clear intent
5. Infer missing context when reasonable
6. Explicitly clarify assumptions before generating response

Return ONLY valid JSON with these exact fields:
{
  "actions": ["array of specific actions required"],
  "deadlines": ["array of deadlines or timeframes"],
  "urgency": "Urgent" | "Important" | "Informational",
  "confusingParts": [{"sentence": "confusing text", "explanation": "why it's confusing"}],
  "nextStep": "clear next action statement",
  "summary": "concise, decision-focused summary"
}

The summary must be concise, decision-focused, and free of headers.
Assume official announcement context when unclear.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this message: "${normalizedInput}"` }
    ];

    let lastError: unknown = null;
    
    for (let attempt = 0; attempt < this.API_KEYS.length; attempt++) {
      const keyIndex = attempt;
      
      if (this.keyStatuses[keyIndex]?.isExhausted || 
          this.keyStatuses[keyIndex]?.isRateLimited) {
        continue;
      }

      try {
        const content = await this.makeRequest(messages, keyIndex);
        
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

    const activeKeys = this.keyStatuses.filter(status => 
      !status.isExhausted && !status.isRateLimited
    ).length;
    
    if (activeKeys === 0) {
      throw createError('All OpenRouter API keys are exhausted or rate limited. Please try again later.', 'ALL_KEYS_EXHAUSTED', true);
    }

    const errorMessage = getErrorMessage(lastError);
    throw new Error(errorMessage || 'Failed to analyze text with OpenRouter');
  }

  private normalizeInput(input: string): string {
    return input
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  }

  private validateAndNormalizeResponse(response: Record<string, unknown>): Record<string, unknown> {
    return {
      actions: Array.isArray(response.actions) ? response.actions : [],
      deadlines: Array.isArray(response.deadlines) ? response.deadlines : [],
      urgency: ["Urgent", "Important", "Informational"].includes(response.urgency as string)
        ? response.urgency
        : "Informational",
      confusingParts: Array.isArray(response.confusingParts) ? response.confusingParts : [],
      nextStep: typeof response.nextStep === "string" ? response.nextStep : "No action specified",
      summary: typeof response.summary === "string" ? response.summary : ""
    };
  }

  getKeyStatuses(): APIKeyStatus[] {
    return [...this.keyStatuses];
  }

  resetKeyStatuses(): void {
    this.keyStatuses = this.API_KEYS.map((_, index) => ({ keyIndex: index }));
  }
}

export const openRouterAPI = new OpenRouterAPI();