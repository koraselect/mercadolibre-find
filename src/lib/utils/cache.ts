interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache en memoria con TTL (TODO §52).
 * Util para fingerprints de Gemini (mismo producto = mismo fingerprint).
 */
export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/** Cache global para fingerprints de Gemini (1 hora TTL). */
export const fingerprintCache = new MemoryCache(60 * 60 * 1000);

/** Cache global para resultados de matching (30 min TTL). */
export const matchCache = new MemoryCache(30 * 60 * 1000);
