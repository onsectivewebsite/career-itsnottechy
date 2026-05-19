import { describe, expect, it, beforeEach } from 'vitest';
import { checkRateLimit, __resetRateLimitsForTests } from './rateLimit';

beforeEach(() => __resetRateLimitsForTests());

describe('checkRateLimit', () => {
  it('allows up to capacity then blocks', () => {
    const args = { key: 'k', capacity: 3, refillPerSec: 1 };
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    const r4 = checkRateLimit(args, 0);
    expect(r4.allowed).toBe(false);
    if (!r4.allowed) expect(r4.retryAfterMs).toBe(1000);
  });

  it('refills over time', () => {
    const args = { key: 'k2', capacity: 2, refillPerSec: 1 };
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(true);
    expect(checkRateLimit(args, 0).allowed).toBe(false);
    expect(checkRateLimit(args, 1500).allowed).toBe(true);   // 1.5s later, +1.5 tokens, drain 1
    expect(checkRateLimit(args, 1500).allowed).toBe(false);
  });

  it('per-key isolation', () => {
    const mk = (k: string) => ({ key: k, capacity: 1, refillPerSec: 1 });
    expect(checkRateLimit(mk('a'), 0).allowed).toBe(true);
    expect(checkRateLimit(mk('a'), 0).allowed).toBe(false);
    expect(checkRateLimit(mk('b'), 0).allowed).toBe(true);
  });
});
