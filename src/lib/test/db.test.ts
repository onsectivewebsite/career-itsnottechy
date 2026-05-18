import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from './db';

describe('resetDb', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('starts with an empty User table', async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it('clears records inserted by a previous test', async () => {
    await prisma.user.create({
      data: { email: 'a@b.com', name: 'A', role: 'CANDIDATE' },
    });
    expect(await prisma.user.count()).toBe(1);
    await resetDb();
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses to run against a non-test DB', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://x:y@z/careers?schema=public';
    await expect(resetDb()).rejects.toThrow(/refused/);
    process.env.DATABASE_URL = original;
  });
});
