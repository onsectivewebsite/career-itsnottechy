import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  createJob,
  updateJob,
  publishJob,
  closeJob,
  listJobsForHr,
  listPublicJobs,
  getPublicJob,
} from './jobService';

async function makeHr() {
  return prisma.user.create({
    data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' },
  });
}

const jobFixture = {
  title: 'Software Engineer',
  department: 'Engineering',
  locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const,
  description: 'We build practical software for working teams.',
  requirements: 'Three years backend.',
  customQuestions: [],
  currency: 'USD',
};

describe('createJob', () => {
  beforeEach(() => resetDb());

  it('creates a job in DRAFT status', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const job = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(job?.status).toBe('DRAFT');
    expect(job?.title).toBe('Software Engineer');
  });

  it('records an audit row', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    expect(r.ok).toBe(true);
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'JOB_CREATED')).toBe(true);
  });

  it('returns INVALID on bad input', async () => {
    const hr = await makeHr();
    const r = await createJob({
      input: { ...jobFixture, title: '', description: 'too short' },
      postedByUserId: hr.id,
    });
    expect(r).toEqual({ ok: false, reason: 'INVALID' });
  });
});

describe('publishJob / closeJob', () => {
  beforeEach(() => resetDb());

  it('moves DRAFT to OPEN and then to CLOSED with audit', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();

    expect((await publishJob({ jobId: r.jobId, actorUserId: hr.id })).ok).toBe(true);
    const opened = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(opened?.status).toBe('OPEN');

    expect((await closeJob({ jobId: r.jobId, actorUserId: hr.id })).ok).toBe(true);
    const closed = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(closed?.status).toBe('CLOSED');
    expect(closed?.closedAt).not.toBeNull();
  });

  it('returns NOT_FOUND when publishing a non-existent job', async () => {
    const hr = await makeHr();
    const r = await publishJob({ jobId: 'nope', actorUserId: hr.id });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('updateJob', () => {
  beforeEach(() => resetDb());

  it('updates an existing job', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    const upd = await updateJob({
      jobId: r.jobId,
      input: { ...jobFixture, title: 'Updated Title' },
      actorUserId: hr.id,
    });
    expect(upd.ok).toBe(true);
    const job = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(job?.title).toBe('Updated Title');
  });

  it('returns NOT_FOUND for missing jobs', async () => {
    const hr = await makeHr();
    const r = await updateJob({ jobId: 'nope', input: jobFixture, actorUserId: hr.id });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('listPublicJobs', () => {
  beforeEach(() => resetDb());

  it('shows only OPEN jobs', async () => {
    const hr = await makeHr();
    const open = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!open.ok) throw new Error();
    await publishJob({ jobId: open.jobId, actorUserId: hr.id });
    await createJob({ input: { ...jobFixture, title: 'Draft Job' }, postedByUserId: hr.id });

    const list = await listPublicJobs({});
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Software Engineer');
  });

  it('filters by department', async () => {
    const hr = await makeHr();
    const a = await createJob({ input: { ...jobFixture, department: 'Engineering' }, postedByUserId: hr.id });
    const b = await createJob({ input: { ...jobFixture, title: 'Designer', department: 'Design' }, postedByUserId: hr.id });
    if (!a.ok || !b.ok) throw new Error();
    await publishJob({ jobId: a.jobId, actorUserId: hr.id });
    await publishJob({ jobId: b.jobId, actorUserId: hr.id });

    const list = await listPublicJobs({ department: 'Design' });
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Designer');
  });

  it('filters by locationType', async () => {
    const hr = await makeHr();
    const a = await createJob({ input: jobFixture, postedByUserId: hr.id });
    const b = await createJob({
      input: { ...jobFixture, title: 'Onsite role', locationType: 'ONSITE', locationCity: 'Berlin' },
      postedByUserId: hr.id,
    });
    if (!a.ok || !b.ok) throw new Error();
    await publishJob({ jobId: a.jobId, actorUserId: hr.id });
    await publishJob({ jobId: b.jobId, actorUserId: hr.id });

    const list = await listPublicJobs({ locationType: 'ONSITE' });
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Onsite role');
  });

  it('search by query matches title case-insensitively', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    await publishJob({ jobId: r.jobId, actorUserId: hr.id });
    const hits = await listPublicJobs({ q: 'engineer' });
    expect(hits).toHaveLength(1);
    const misses = await listPublicJobs({ q: 'designer' });
    expect(misses).toHaveLength(0);
  });
});

describe('getPublicJob', () => {
  beforeEach(() => resetDb());

  it('returns null for DRAFT or CLOSED jobs', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    expect(await getPublicJob(r.jobId)).toBeNull();
  });

  it('returns the job when OPEN', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    await publishJob({ jobId: r.jobId, actorUserId: hr.id });
    const got = await getPublicJob(r.jobId);
    expect(got?.title).toBe('Software Engineer');
  });
});

describe('listJobsForHr', () => {
  beforeEach(() => resetDb());

  it('returns ALL jobs regardless of status', async () => {
    const hr = await makeHr();
    const a = await createJob({ input: jobFixture, postedByUserId: hr.id });
    const b = await createJob({ input: { ...jobFixture, title: 'Other' }, postedByUserId: hr.id });
    if (!a.ok || !b.ok) throw new Error();
    await publishJob({ jobId: a.jobId, actorUserId: hr.id });
    const list = await listJobsForHr();
    expect(list).toHaveLength(2);
  });
});
