import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { applicationInputSchema } from '@/lib/validation/jobs';
import type { CustomQuestion } from '@/types/customQuestions';

export type SubmitResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: 'JOB_NOT_OPEN' | 'ALREADY_APPLIED' | 'INVALID_ANSWERS' };

export async function submitApplication(args: {
  jobId: string;
  candidateUserId: string;
  input: { jobId: string; resumeUrl: string; coverLetter?: string; customAnswers: Record<string, string> };
}): Promise<SubmitResult> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!job || job.status !== 'OPEN') return { ok: false, reason: 'JOB_NOT_OPEN' };

  const questions = (job.customQuestions as unknown as CustomQuestion[]) ?? [];
  const parsed = applicationInputSchema(questions).safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID_ANSWERS' };

  const existing = await prisma.application.findUnique({
    where: { jobId_candidateUserId: { jobId: args.jobId, candidateUserId: args.candidateUserId } },
  });
  if (existing) return { ok: false, reason: 'ALREADY_APPLIED' };

  const candidate = await prisma.user.findUnique({ where: { id: args.candidateUserId } });
  if (!candidate) return { ok: false, reason: 'JOB_NOT_OPEN' }; // shouldn't happen; defensive

  const app = await prisma.application.create({
    data: {
      jobId: args.jobId,
      candidateUserId: args.candidateUserId,
      stage: 'APPLIED',
      resumeUrl: parsed.data.resumeUrl,
      coverLetter: parsed.data.coverLetter ?? null,
      customAnswers: parsed.data.customAnswers as unknown as Prisma.InputJsonValue,
    },
  });

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
