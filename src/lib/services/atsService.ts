import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

const FORWARD: Record<AppStage, AppStage[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
};

export function isValidTransition(from: AppStage, to: AppStage): boolean {
  if (from === to) return false;
  return FORWARD[from].includes(to);
}

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED:   'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER:     'Offer extended',
  HIRED:     'Hired',
  REJECTED:  'Not moving forward',
};

const STAGE_BLURB: Record<AppStage, string> = {
  APPLIED:   'We received your application and will review it shortly.',
  SCREENING: 'Our team is reviewing your background in detail.',
  INTERVIEW: 'You will be invited to an interview shortly — watch for a scheduling email.',
  OFFER:     '',
  HIRED:     'Welcome to ItsNotTechy. Our HR team will be in touch with next steps.',
  REJECTED:  'Thank you for your interest. We have decided not to move forward at this time.',
};

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' };

export async function moveStage(args: {
  applicationId: string;
  toStage: AppStage;
  actorUserId: string;
}): Promise<MoveResult> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: { job: true, candidate: true },
  });
  if (!app) return { ok: false, reason: 'NOT_FOUND' };
  if (!isValidTransition(app.stage, args.toStage)) {
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }

  await prisma.application.update({
    where: { id: args.applicationId },
    data: { stage: args.toStage },
  });

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'APP_STAGE_CHANGED',
    entityType: 'Application',
    entityId: args.applicationId,
    metadata: { from: app.stage, to: args.toStage },
  });

  const dashboardUrl = `${process.env.APP_URL ?? ''}/dashboard/candidate`;

  if (args.toStage === 'OFFER') {
    await sendEmail({
      to: app.candidate.email,
      template: 'offer-sent',
      data: { name: app.candidate.name, jobTitle: app.job.title, dashboardUrl },
    });
  } else {
    await sendEmail({
      to: app.candidate.email,
      template: 'application-status-changed',
      data: {
        name: app.candidate.name,
        jobTitle: app.job.title,
        stageLabel: STAGE_LABEL[args.toStage],
        stageBlurb: STAGE_BLURB[args.toStage],
        dashboardUrl,
      },
    });
  }

  return { ok: true };
}

export async function listApplicationsForJob(jobId: string) {
  return prisma.application.findMany({
    where: { jobId },
    orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    include: {
      candidate: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getApplicationForHr(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      candidate: { include: { candidateProfile: true } },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
      },
      referral: true,
    },
  });
}
