import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AclResult = { allowed: true } | { allowed: false; reason: 'NOT_FOUND' | 'FORBIDDEN' };

/**
 * Per spec §7: SUPER_ADMIN and HR_MANAGER always allowed. Others must be the
 * owning candidate / referrer / promotion submitter / promotion manager for
 * the entity that references this file path. Orphan paths are NOT_FOUND.
 */
export async function checkFileAcl(args: {
  path: string;
  user: { id: string; role: Role };
}): Promise<AclResult> {
  if (args.user.role === 'SUPER_ADMIN' || args.user.role === 'HR_MANAGER') {
    return { allowed: true };
  }

  const app = await prisma.application.findFirst({
    where: { resumeUrl: args.path },
    select: { candidateUserId: true, referral: { select: { referringUserId: true } } },
  });
  if (app) {
    if (app.candidateUserId === args.user.id) return { allowed: true };
    if (app.referral?.referringUserId === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  const referral = await prisma.referral.findFirst({
    where: { resumeUrl: args.path },
    select: { referringUserId: true },
  });
  if (referral) {
    if (referral.referringUserId === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  const promo = await prisma.promotionRequest.findFirst({
    where: { supportingDocUrl: args.path },
    select: { employeeUserId: true, managerUserId: true },
  });
  if (promo) {
    if (promo.employeeUserId === args.user.id) return { allowed: true };
    if (promo.managerUserId  === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }

  return { allowed: false, reason: 'NOT_FOUND' };
}
