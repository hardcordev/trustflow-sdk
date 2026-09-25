import { TrustFlowError } from '../errors';

export type DelayStrategy = number | ((attempt: number) => number);

export interface RetryOptions {
  /** Maximum number of execution attempts. Must be a finite integer >= 1. */
  attempts: number;
  /**
   * Delay between attempts. A number is a base delay in ms (finite, >= 0) that scales
   * linearly with the attempt number (`delayMs * attempt`); a function receives the
   * 1-indexed attempt number and returns the delay in ms.
   */
  delayMs?: DelayStrategy;
  /**
   * Optional callback invoked after every failed attempt, including the last one.
   * `info.willRetry` is `false` when no further attempt follows, and `info.delayMs` is the
   * delay before the next attempt (`0` when none follows). Errors thrown by the callback are
   * swallowed and never replace the operation's error or stop the loop.
   */
  onRetry?: OnRetryCallback;
}

export interface RetryInfo {
  /** Whether another attempt will be made after this failure */
  willRetry: boolean;
  /** Delay in ms before the next attempt (0 when no attempt follows) */
  delayMs: number;
}

export type OnRetryCallback = (attempt: number, error: unknown, info: RetryInfo) => void;

function assertValidDelay(d: DelayStrategy): void {
  if (typeof d === 'number' && (!Number.isFinite(d) || d < 0)) {
    throw TrustFlowError.validation('delayMs', 'must be a finite number >= 0');
  }
}

/**
 * Generic retry helper with customizable backoff strategies and per-attempt callbacks.
 *
 * @param fn Function to execute, receiving the current 1-indexed attempt number
 * @param attemptsOrOptions Total attempts (number) or a `RetryOptions` configuration object
 * @param delayMs Optional delay in ms (number for linear scaling) or a delay strategy function
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  attemptsOrOptions: number | RetryOptions,
  delayMs?: DelayStrategy,
): Promise<T> {
  let attempts: number;
  let delayStrategy: (attempt: number) => number;
  let onRetry: OnRetryCallback | undefined;

  if (typeof attemptsOrOptions === 'object') {
    attempts = attemptsOrOptions.attempts;
    const d = attemptsOrOptions.delayMs ?? 0;
    assertValidDelay(d);
    delayStrategy = typeof d === 'function' ? d : (attempt: number) => d * attempt;
    onRetry = attemptsOrOptions.onRetry;
  } else {
    attempts = attemptsOrOptions;
    const d = delayMs ?? 0;
    assertValidDelay(d);
    delayStrategy = typeof d === 'function' ? d : (attempt: number) => d * attempt;
  }

  if (!Number.isInteger(attempts) || attempts < 1) {
    throw TrustFlowError.validation('attempts', 'must be a finite integer >= 1');
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      const willRetry = attempt < attempts;
      const delay = willRetry ? delayStrategy(attempt) : 0;
      if (onRetry) {
        try {
          onRetry(attempt, e, { willRetry, delayMs: delay });
        } catch {
          // A failing observer must not hide the operation's error or stop the loop.
        }
      }
      if (willRetry) {
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }

  throw (
    lastErr ??
    new TrustFlowError('Retry failed', 'RETRY_EXHAUSTED')
  );
}
