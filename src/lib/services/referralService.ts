import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { referralInputSchema, type ReferralInput } from '@/lib/validation/referrals';
import { STAGE_LABEL } from '@/lib/ats/stages';

export type SubmitReferralResult =
  | { ok: true; referralId: string }
  | { ok: false; reason: 'INVALID' | 'JOB_NOT_OPEN' | 'DUPLICATE' };

export async function submitReferral(args: {
  referringUserId: string;
  input: ReferralInput;
}): Promise<SubmitReferralResult> {
  const parsed = referralInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } });
  if (!job || job.status !== 'OPEN') return { ok: false, reason: 'JOB_NOT_OPEN' };

  // Pre-check for duplicate (same referrer + email + job).
  const dupe = await prisma.referral.findFirst({
    where: {
      referringUserId: args.referringUserId,
      candidateEmail: parsed.data.candidateEmail,
      jobId: parsed.data.jobId,
    },
  });
  if (dupe) return { ok: false, reason: 'DUPLICATE' };

  const referral = await prisma.referral.create({
    data: {
      referringUserId: args.referringUserId,
      jobId: parsed.data.jobId,
      candidateName: parsed.data.candidateName,
      candidateEmail: parsed.data.candidateEmail,
      relationship: parsed.data.relationship,
      resumeUrl: parsed.data.resumeUrl ?? null,
      status: 'SUBMITTED',
    },
  });

  const referrer = await prisma.user.findUniqueOrThrow({ where: { id: args.referringUserId } });

  await recordAudit({
    actorUserId: args.referringUserId,
    action: 'REFERRAL_SUBMITTED',
    entityType: 'Referral',
    entityId: referral.id,
    metadata: { jobId: parsed.data.jobId, candidateEmail: parsed.data.candidateEmail },
  });

  await sendEmail({
    to: referrer.email,
    template: 'referral-submitted',
    data: {
      referrerName: referrer.name,
      candidateName: parsed.data.candidateName,
      jobTitle: job.title,
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/employee/referrals`,
    },
  });

  const hrGroup = await prisma.user.findMany({ where: { role: 'HR_MANAGER', isActive: true } });
  for (const hr of hrGroup) {
    await sendEmail({
      to: hr.email,
      template: 'referral-submitted',
      data: {
        referrerName: referrer.name,
        candidateName: parsed.data.candidateName,
        jobTitle: job.title,
        dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/hr/referrals`,
      },
    });
  }

  return { ok: true, referralId: referral.id };
}

export async function listMyReferrals(referringUserId: string) {
  return prisma.referral.findMany({
    where: { referringUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, department: true, status: true } },
      application: { select: { id: true, stage: true } },
    },
  });
}

export async function listAllReferrals() {
  return prisma.referral.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, department: true, status: true } },
      referringUser: { select: { id: true, name: true, email: true } },
      application: { select: { id: true, stage: true } },
    },
  });
}

export async function autoLinkOnCandidateRegistered(args: {
  candidateUserId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: args.candidateUserId } });
  if (!user) return;
  await prisma.referral.updateMany({
    where: { candidateEmail: user.email, status: 'SUBMITTED' },
    data: { status: 'CONTACTED' },
  });
}

export async function notifyReferrerOnStageChange(args: {
  applicationId: string;
  newStage: AppStage;
}): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: {
      job: { select: { title: true } },
      referral: { include: { referringUser: { select: { id: true, name: true, email: true } } } },
      candidate: { select: { name: true } },
    },
  });
  if (!app || !app.referral) return;

  // CONVERTED is set at apply time (applicationService.submitApplication).
  // Here we only need to flip to REJECTED if the stage move was a rejection.
  if (args.newStage === 'REJECTED' && app.referral.status !== 'REJECTED') {
    await prisma.referral.update({
      where: { id: app.referral.id },
      data: { status: 'REJECTED' },
    });
  }

  await sendEmail({
    to: app.referral.referringUser.email,
    template: 'referral-status-update',
    data: {
      referrerName: app.referral.referringUser.name,
      candidateName: app.candidate.name,
      jobTitle: app.job.title,
      stageLabel: STAGE_LABEL[args.newStage],
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/employee/referrals`,
    },
  });
}
