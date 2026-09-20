import { logger } from "@/lib/logging/logger";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
};

/**
 * Ejecuta una funcion con reintentos y backoff exponencial.
 * Util para llamadas a APIs externas (ML, Gemini).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
  context?: string
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === config.maxAttempts) break;

      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      logger.warn("retry.attempt_failed", {
        context,
        attempt,
        maxAttempts: config.maxAttempts,
        delayMs: delay,
        cause: lastError.message.slice(0, 120),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("Retry failed without error");
}

/**
 * Wrapper para fetch con timeout y reintentos.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        logger.warn("fetch.rate_limited", { url: url.slice(0, 100), retryAfter: delay });
        await new Promise((r) => setTimeout(r, delay));
        throw new Error("Rate limited");
      }

      if (res.status >= 500) {
        throw new Error(`Server error: ${res.status}`);
      }

      return res;
    },
    opts,
    `fetch:${url.slice(0, 60)}`
  );
}
