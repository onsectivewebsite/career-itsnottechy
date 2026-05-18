import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { isValidTransition, STAGE_LABEL as STAGE_NAME } from '@/lib/ats/stages';

// Re-export so existing imports `import { isValidTransition } from './atsService'` keep working.
export { isValidTransition };

// Email copy lives here because it's only used by sendEmail wiring;
// the UI uses STAGE_LABEL from @/lib/ats/stages (short, "Offer" not "Offer extended").
const STAGE_EMAIL_LABEL: Record<AppStage, string> = {
  APPLIED:   'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER:     'Offer extended',  // unused at runtime — OFFER uses dedicated template
  HIRED:     'Hired',
  REJECTED:  'Not moving forward',
};

const STAGE_BLURB: Record<Exclude<AppStage, 'OFFER'>, string> = {
  APPLIED:   'We received your application and will review it shortly.',
  SCREENING: 'Our team is reviewing your background in detail.',
  INTERVIEW: 'You will be invited to an interview shortly — watch for a scheduling email.',
  HIRED:     'Welcome to ItsNotTechy. Our HR team will be in touch with next steps.',
  REJECTED:  'Thank you for your interest. We have decided not to move forward at this time.',
};

// Silence unused-warning during reads while preserving the constant for future callers.
void STAGE_NAME;

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

  // Atomic claim: only succeeds if the row is STILL at the stage we read.
  // Prevents two concurrent moves from both passing the transition check.
  const claim = await prisma.application.updateMany({
    where: { id: args.applicationId, stage: app.stage },
    data: { stage: args.toStage },
  });
  if (claim.count === 0) {
    // Someone else moved it between our read and our write. Reject as INVALID_TRANSITION
    // (the user's intended transition no longer applies from the new current stage).
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }

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
        stageLabel: STAGE_EMAIL_LABEL[args.toStage],
        stageBlurb: STAGE_BLURB[args.toStage as Exclude<AppStage, 'OFFER'>],
        dashboardUrl,
      },
    });
  }

  return { ok: true };
}

export async function listApplicationsForJob(jobId: string) {
  // Note: stage is not sorted at the DB layer (Prisma `stage: 'asc'` is alphabetical,
  // not pipeline order). Callers re-bucket via STAGE_ORDER from @/lib/ats/stages.
  return prisma.application.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Shared HR-side query that aggregates the inbox across all jobs.
 * Used by /dashboard/hr/applicants. Filters out terminal stages.
 */
export async function listActiveApplicationsForHr() {
  return prisma.application.findMany({
    where: { stage: { notIn: ['HIRED', 'REJECTED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      candidate: { select: { id: true, name: true, email: true } },
      referral: { select: { id: true } },
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
      referral: {
        include: {
          referringUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}
