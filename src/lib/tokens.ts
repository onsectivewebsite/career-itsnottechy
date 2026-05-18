import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS  =     60 * 60 * 1000;       // 1 hour

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export function generateTokenString(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function issueInviteToken(userId: string): Promise<string> {
  const token = generateTokenString();
  await prisma.inviteToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return token;
}

export async function consumeInviteToken(token: string): Promise<ConsumeResult> {
  const row = await prisma.inviteToken.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.usedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  await prisma.inviteToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true, userId: row.userId };
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = generateTokenString();
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<ConsumeResult> {
  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.usedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true, userId: row.userId };
}
