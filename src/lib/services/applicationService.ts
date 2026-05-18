import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { applicationInputSchema } from '@/lib/validation/jobs';
import type { CustomQuestion } from '@/types/customQuestions';

export type SubmitResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: 'JOB_NOT_OPEN' | 'DEADLINE_PASSED' | 'ALREADY_APPLIED' | 'INVALID_ANSWERS' | 'CANDIDATE_NOT_FOUND' };

export async function submitApplication(args: {
  jobId: string;
  candidateUserId: string;
  input: { jobId: string; resumeUrl: string; coverLetter?: string; customAnswers: Record<string, string> };
}): Promise<SubmitResult> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!job || job.status !== 'OPEN') return { ok: false, reason: 'JOB_NOT_OPEN' };
  if (job.deadline && job.deadline.getTime() < Date.now()) {
    return { ok: false, reason: 'DEADLINE_PASSED' };
  }

  const questions = (job.customQuestions as unknown as CustomQuestion[]) ?? [];
  const parsed = applicationInputSchema(questions).safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID_ANSWERS' };

  const candidate = await prisma.user.findUnique({ where: { id: args.candidateUserId } });
  if (!candidate) return { ok: false, reason: 'CANDIDATE_NOT_FOUND' };

  let app;
  try {
    app = await prisma.application.create({
      data: {
        jobId: args.jobId,
        candidateUserId: args.candidateUserId,
        stage: 'APPLIED',
        resumeUrl: parsed.data.resumeUrl,
        coverLetter: parsed.data.coverLetter ?? null,
        customAnswers: parsed.data.customAnswers as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // P2002 unique-constraint violation on (jobId, candidateUserId) — second concurrent submit lost the race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'ALREADY_APPLIED' };
    }
    throw err;
  }

  // Auto-link the application to a matching pending referral (if any).
  // Update only if there's exactly one matching referral not yet linked.
  const matchingReferral = await prisma.referral.findFirst({
    where: {
      jobId: args.jobId,
      candidateEmail: candidate.email,
      applicationId: null,
    },
  });
  if (matchingReferral) {
    await prisma.referral.update({
      where: { id: matchingReferral.id },
      data: { applicationId: app.id },
    });
    await prisma.application.update({
      where: { id: app.id },
      data: { referralId: matchingReferral.id },
    });
  }

  await recordAudit({
    actorUserId: args.candidateUserId,
    action: 'APPLICATION_SUBMITTED',
    entityType: 'Application',
    entityId: app.id,
    metadata: { jobId: args.jobId },
  });

  await sendEmail({
    to: candidate.email,
    template: 'application-received',
    data: {
      name: candidate.name,
      jobTitle: job.title,
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, applicationId: app.id };
}

export async function listMyApplications(candidateUserId: string) {
  return prisma.application.findMany({
    where: { candidateUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          department: true,
          locationType: true,
          locationCity: true,
          type: true,
          status: true,
        },
      },
    },
  });
}

export async function getApplicationForCandidate(applicationId: string, candidateUserId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, candidateUserId },
    include: { job: true },
  });
}
