import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { toggleSavedJob, listSavedJobs, getSavedJobIds } from './savedJobService';

async function fixtures() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE' } });
  const job = await prisma.job.create({
    data: {
      title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'A description long enough to be valid.', requirements: 'Reqs.',
      status: 'OPEN', postedById: hr.id,
    },
  });
  return { cand, job };
}

describe('toggleSavedJob', () => {
  beforeEach(() => resetDb());

  it('saves then unsaves a job', async () => {
    const { cand, job } = await fixtures();
    const first = await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    expect(first).toEqual({ ok: true, saved: true });
    const second = await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    expect(second).toEqual({ ok: true, saved: false });
    expect(await prisma.savedJob.count()).toBe(0);
  });

  it('returns JOB_NOT_FOUND for an unknown job', async () => {
    const { cand } = await fixtures();
    const r = await toggleSavedJob({ candidateUserId: cand.id, jobId: 'nope' });
    expect(r).toEqual({ ok: false, reason: 'JOB_NOT_FOUND' });
  });
});

describe('listSavedJobs / getSavedJobIds', () => {
  beforeEach(() => resetDb());

  it('lists saved jobs with job data and returns the id set', async () => {
    const { cand, job } = await fixtures();
    await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    const list = await listSavedJobs(cand.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.job.title).toBe('Designer');
    const ids = await getSavedJobIds(cand.id);
    expect(ids.has(job.id)).toBe(true);
    expect(ids.size).toBe(1);
  });
});
