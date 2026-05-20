import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { jobInputSchema, type JobInput } from '@/lib/validation/jobs';
import { sanitizeRichHtml } from '@/lib/richText';

export async function createJob(args: {
  input: JobInput;
  postedByUserId: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; reason: 'INVALID' }> {
  const parsed = jobInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      department: parsed.data.department,
      locationType: parsed.data.locationType,
      locationCity: parsed.data.locationCity ?? null,
      type: parsed.data.type,
      description: sanitizeRichHtml(parsed.data.description),
      requirements: sanitizeRichHtml(parsed.data.requirements),
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      deadline: parsed.data.deadline ?? null,
      customQuestions: parsed.data.customQuestions as unknown as Prisma.InputJsonValue,
      requiredDocuments: parsed.data.requiredDocuments as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
      postedById: args.postedByUserId,
    },
  });
  await recordAudit({
    actorUserId: args.postedByUserId,
    action: 'JOB_CREATED',
    entityType: 'Job',
    entityId: job.id,
    metadata: { title: job.title },
  });
  return { ok: true, jobId: job.id };
}

export async function updateJob(args: {
  jobId: string;
  input: JobInput;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'INVALID' | 'NOT_FOUND' }> {
  const parsed = jobInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };
  const existing = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  await prisma.job.update({
    where: { id: args.jobId },
    data: {
      title: parsed.data.title,
      department: parsed.data.department,
      locationType: parsed.data.locationType,
      locationCity: parsed.data.locationCity ?? null,
      type: parsed.data.type,
      description: sanitizeRichHtml(parsed.data.description),
      requirements: sanitizeRichHtml(parsed.data.requirements),
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      deadline: parsed.data.deadline ?? null,
      customQuestions: parsed.data.customQuestions as unknown as Prisma.InputJsonValue,
      requiredDocuments: parsed.data.requiredDocuments as unknown as Prisma.InputJsonValue,
    },
  });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_UPDATED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function publishJob(args: {
  jobId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' }> {
  const r = await prisma.job.updateMany({
    where: { id: args.jobId },
    data: { status: 'OPEN', closedAt: null },
  });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_PUBLISHED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function closeJob(args: {
  jobId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' }> {
  const r = await prisma.job.updateMany({
    where: { id: args.jobId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_CLOSED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function listJobsForHr() {
  return prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { applications: true } } },
  });
}

export type PublicJobFilters = {
  q?: string;
  department?: string;
  locationType?: 'REMOTE' | 'ONSITE' | 'HYBRID';
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
};

export async function listPublicJobs(filters: PublicJobFilters) {
  return prisma.job.findMany({
    where: {
      status: 'OPEN',
      ...(filters.department ? { department: filters.department } : {}),
      ...(filters.locationType ? { locationType: filters.locationType } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.q
        ? {
            OR: [
              { title:       { contains: filters.q, mode: 'insensitive' as const } },
              { description: { contains: filters.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPublicJob(id: string) {
  return prisma.job.findFirst({
    where: { id, status: 'OPEN' },
  });
}
