import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes a password to a non-empty string different from the input', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe('hunter2');
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter3', hash)).toBe(false);
  });

  it('rejects when hash is null or empty', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});
