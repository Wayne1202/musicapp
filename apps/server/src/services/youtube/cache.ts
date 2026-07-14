/**
 * Small cache abstraction so callers (search results, the trending-fallback pool, ...) depend
 * on an interface rather than a concrete store — swapping the in-memory implementation for
 * Redis later (needed once this runs on more than one instance) becomes a one-file change
 * instead of touching every call site.
 */
export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs: number): void;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Process-local, TTL-per-entry. Fine for today's single-instance deployment (same tier as the
 *  in-memory presence/vote/auto-end state already used elsewhere in this app) — resets on
 *  restart/redeploy, not shared across horizontally-scaled instances. */
export class InMemoryCache<T> implements Cache<T> {
  private store = new Map<string, Entry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
