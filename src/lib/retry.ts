/**
 * Retry a function with exponential backoff.
 * Retries on transient errors (network failures, 429, 500, 502, 503, 504).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; shouldRetry?: (error: unknown) => boolean } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, shouldRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable = shouldRetry ? shouldRetry(error) : isTransientError(error);

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('Retry exhausted');
}

function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true; // Network error
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return [429, 500, 502, 503, 504].includes(status);
  }
  return false;
}

/** Helper to create a retryable fetch error with status */
export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}
