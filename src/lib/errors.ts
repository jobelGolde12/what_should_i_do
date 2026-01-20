export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export const ERROR_CODES = {
  INPUT_TOO_SHORT: 'INPUT_TOO_SHORT',
  API_KEY_EXHAUSTED: 'API_KEY_EXHAUSTED',
  ALL_KEYS_EXHAUSTED: 'ALL_KEYS_EXHAUSTED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TEXT_TOO_LONG: 'TEXT_TOO_LONG',
  INVALID_JSON: 'INVALID_JSON',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export function createError(
  message: string,
  code: keyof typeof ERROR_CODES = 'UNKNOWN_ERROR',
  retryable: boolean = false
): AnalysisError {
  return new AnalysisError(message, ERROR_CODES[code], retryable);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AnalysisError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AnalysisError) {
    return error.retryable;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || 
           message.includes('network') || 
           message.includes('timeout');
  }
  
  return false;
}