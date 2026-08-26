/**
 * Minimal in-memory sliding-window rate limiter.
 * Keyed per client IP + action. Good enough for a single-node deployment and
 * prevents the obvious abuse vectors (claim spam, preview flooding).
 */

interface Bucket {
  hits: number[];
}

const g = globalThis as unknown as { __mythicRate?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  if (!g.__mythicRate) g.__mythicRate = new Map();
  return g.__mythicRate;
}

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  const map = buckets();
  const bucket = map.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    map.set(key, bucket);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }

  bucket.hits.push(now);
  map.set(key, bucket);
  return { ok: true, retryAfterSec: 0 };
}
