import { prisma } from '@/lib/prisma';

export type ToggleSavedResult =
  | { ok: true; saved: boolean }
  | { ok: false; reason: 'JOB_NOT_FOUND' };

/** Save the job if not saved, unsave it if it is. Returns the resulting saved state. */
export async function toggleSavedJob(args: {
  candidateUserId: string;
  jobId: string;
}): Promise<ToggleSavedResult> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId }, select: { id: true } });
  if (!job) return { ok: false, reason: 'JOB_NOT_FOUND' };

  const existing = await prisma.savedJob.findUnique({
    where: { candidateUserId_jobId: { candidateUserId: args.candidateUserId, jobId: args.jobId } },
  });
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    return { ok: true, saved: false };
  }
  await prisma.savedJob.create({
    data: { candidateUserId: args.candidateUserId, jobId: args.jobId },
  });
  return { ok: true, saved: true };
}

/** The candidate's saved jobs with job summary data, newest-saved first. */
export async function listSavedJobs(candidateUserId: string) {
  return prisma.savedJob.findMany({
    where: { candidateUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        select: {
          id: true, title: true, department: true,
          locationType: true, locationCity: true, type: true, status: true,
        },
      },
    },
  });
}

/** The set of job ids this candidate has saved — for rendering save state across a list. */
export async function getSavedJobIds(candidateUserId: string): Promise<Set<string>> {
  const rows = await prisma.savedJob.findMany({
    where: { candidateUserId },
    select: { jobId: true },
  });
  return new Set(rows.map((r) => r.jobId));
}
