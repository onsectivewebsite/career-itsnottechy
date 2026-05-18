import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'EMAIL_TAKEN' };

export async function registerCandidate(input: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterResult> {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: 'EMAIL_TAKEN' };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      role: 'CANDIDATE',
      candidateProfile: { create: {} },
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: 'CANDIDATE' },
  });

  await sendEmail({
    to: user.email,
    template: 'welcome-candidate',
    data: {
      name: user.name,
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, userId: user.id };
}
