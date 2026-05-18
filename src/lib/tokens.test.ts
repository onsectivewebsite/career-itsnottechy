import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  generateTokenString,
  issueInviteToken,
  consumeInviteToken,
  issuePasswordResetToken,
  consumePasswordResetToken,
} from './tokens';

async function makeUser(email = 'u@example.com') {
  return prisma.user.create({
    data: { email, name: 'U', role: 'CANDIDATE' },
  });
}

describe('generateTokenString', () => {
  it('returns a URL-safe string of expected length', () => {
    const t = generateTokenString();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it('produces unique values across calls', () => {
    const a = generateTokenString();
    const b = generateTokenString();
    expect(a).not.toBe(b);
  });
});

describe('invite token lifecycle', () => {
  beforeEach(() => resetDb());

  it('issues a token tied to a user with a future expiry', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);

    const row = await prisma.inviteToken.findUnique({ where: { token } });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(user.id);
    expect(row!.usedAt).toBeNull();
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('consume returns the userId for a valid unused token', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);

    const result = await consumeInviteToken(token);
    expect(result).toEqual({ ok: true, userId: user.id });

    const row = await prisma.inviteToken.findUnique({ where: { token } });
    expect(row!.usedAt).not.toBeNull();
  });

  it('consume rejects an unknown token', async () => {
    const r = await consumeInviteToken('nonsense');
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('consume rejects an already-used token', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);
    await consumeInviteToken(token);

    const r = await consumeInviteToken(token);
    expect(r).toEqual({ ok: false, reason: 'ALREADY_USED' });
  });

  it('consume rejects an expired token', async () => {
    const user = await makeUser();
    const token = generateTokenString();
    await prisma.inviteToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const r = await consumeInviteToken(token);
    expect(r).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('two concurrent consumes of the same valid token: exactly one wins', async () => {
    const user = await makeUser();
    const token = await issueInviteToken(user.id);

    const [a, b] = await Promise.all([
      consumeInviteToken(token),
      consumeInviteToken(token),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({ ok: false, reason: 'ALREADY_USED' });
  });
});

describe('password reset token lifecycle', () => {
  beforeEach(() => resetDb());

  it('issue + consume round-trip', async () => {
    const user = await makeUser();
    const token = await issuePasswordResetToken(user.id);
    const r = await consumePasswordResetToken(token);
    expect(r).toEqual({ ok: true, userId: user.id });
  });

  it('rejects expired reset token', async () => {
    const user = await makeUser();
    const token = generateTokenString();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() - 1) },
    });
    const r = await consumePasswordResetToken(token);
    expect(r).toEqual({ ok: false, reason: 'EXPIRED' });
  });
});
