// Deliberately in-memory and per-process. The selfie search route runs
// InsightFace inference on a shared VM for anonymous callers, so it needs *a*
// brake; at this scale (one Node process on one VM) a Map is enough. If the app
// is ever run multi-instance this has to move to Redis or the database.
export type RateLimiter = {
  allow: (key: string, now?: number) => boolean
}

export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  const hits = new Map<string, { count: number; windowStart: number }>()

  function prune(now: number) {
    hits.forEach((entry, key) => {
      if (now - entry.windowStart >= windowMs) {
        hits.delete(key)
      }
    })
  }

  return {
    allow(key: string, now: number = Date.now()): boolean {
      const entry = hits.get(key)

      if (!entry || now - entry.windowStart >= windowMs) {
        // Keep the map from growing without bound under a rotating-IP flood.
        if (hits.size > 10_000) {
          prune(now)
        }
        hits.set(key, { count: 1, windowStart: now })
        return true
      }

      if (entry.count >= maxRequests) {
        return false
      }

      entry.count += 1
      return true
    },
  }
}
