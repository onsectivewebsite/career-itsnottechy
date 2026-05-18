import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { registerCandidate } from './userService';
import { verifyPassword } from '@/lib/password';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

beforeEach(async () => {
  process.env.EMAIL_TEST_MODE = 'true';
  __resetTransportForTests();
  await resetDb();
});

describe('registerCandidate', () => {
  it('creates a User+CandidateProfile, hashes the password, sends welcome email', async () => {
    const result = await registerCandidate({
      email: 'alice@example.com',
      password: 'Hunter2pass',
      name: 'Alice',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { candidateProfile: true },
    });
    expect(user?.role).toBe('CANDIDATE');
    expect(user?.candidateProfile).not.toBeNull();
    expect(await verifyPassword('Hunter2pass', user!.passwordHash)).toBe(true);

    expect(__recordedSendsForTests()).toHaveLength(1);
    expect(__recordedSendsForTests()[0]?.to).toBe('alice@example.com');

    const audits = await prisma.auditLog.findMany();
    expect(audits.find((a) => a.action === 'USER_REGISTERED')).toBeDefined();
  });

  it('lowercases the email', async () => {
    const r = await registerCandidate({
      email: 'BOB@Example.com', password: 'Hunter2pass', name: 'Bob',
    });
    expect(r.ok).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: 'bob@example.com' } });
    expect(user).not.toBeNull();
  });

  it('returns EMAIL_TAKEN when email already exists', async () => {
    await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' });
    const r = await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A2' });
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });
});
