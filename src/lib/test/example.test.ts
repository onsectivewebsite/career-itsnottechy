import { describe, expect, it } from 'vitest';

describe('vitest sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('reads env from setup', () => {
    expect(process.env.EMAIL_TEST_MODE).toBe('true');
  });
});
