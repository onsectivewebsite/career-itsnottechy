type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

export type RateLimitInput = {
  key: string;            // e.g., "login:1.2.3.4"
  capacity: number;       // max tokens
  refillPerSec: number;   // tokens added per second (steady-state rate)
  cost?: number;          // tokens this hit consumes (default 1)
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export function checkRateLimit(args: RateLimitInput, nowMs = Date.now()): RateLimitResult {
  const cost = args.cost ?? 1;
  let b = buckets.get(args.key);
  if (!b) {
    b = { tokens: args.capacity, lastRefillMs: nowMs };
    buckets.set(args.key, b);
  } else {
    const elapsed = (nowMs - b.lastRefillMs) / 1000;
    b.tokens = Math.min(args.capacity, b.tokens + elapsed * args.refillPerSec);
    b.lastRefillMs = nowMs;
  }
  if (b.tokens < cost) {
    const deficit = cost - b.tokens;
    return { allowed: false, retryAfterMs: Math.ceil((deficit / args.refillPerSec) * 1000) };
  }
  b.tokens -= cost;
  return { allowed: true, remaining: Math.floor(b.tokens) };
}

/** Test-only helper to clear state between tests. */
export function __resetRateLimitsForTests(): void { buckets.clear(); }
