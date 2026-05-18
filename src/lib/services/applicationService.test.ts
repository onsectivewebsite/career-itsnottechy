import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import {
  submitApplication,
  listMyApplications,
  getApplicationForCandidate,
} from './applicationService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

const baseJob = {
  title: 'Software Engineer',
  department: 'Engineering',
  locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const,
  description: 'We build practical software for working teams.',
  requirements: 'Three years backend.',
  customQuestions: [],
  currency: 'USD',
};

async function makeHr() {
  return prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
}
async function makeCandidate(email = 'c@example.com') {
  return prisma.user.create({
    data: { email, name: 'Candidate', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
}
async function makeOpenJob(opts: { customQuestions?: unknown[] } = {}) {
  const hr = await makeHr();
  const r = await createJob({
    input: { ...baseJob, customQuestions: (opts.customQuestions ?? []) as never },
    postedByUserId: hr.id,
  });
  if (!r.ok) throw new Error('job creation failed');
  await publishJob({ jobId: r.jobId, actorUserId: hr.id });
  return r.jobId;
}

describe('submitApplication', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates an Application in APPLIED, fires email, records audit', async () => {
    const jobId = await makeOpenJob();
    const cand = await makeCandidate();
    const r = await submitApplication({
      jobId,
      candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'resume/abc.pdf', coverLetter: 'Hi', customAnswers: {} },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const app = await prisma.application.findUnique({ where: { id: r.applicationId } });
    expect(app?.stage).toBe('APPLIED');

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.to).toBe('c@example.com');
    expect(sends[0]?.subject).toContain('Software Engineer');

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'APPLICATION_SUBMITTED')).toBe(true);
  });

  it('rejects when the job is not OPEN', async () => {
    const hr = await makeHr();
    const job = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!job.ok) throw new Error();
    const cand = await makeCandidate();
    const r = await submitApplication({
      jobId: job.jobId,
      candidateUserId: cand.id,
      input: { jobId: job.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    expect(r).toEqual({ ok: false, reason: 'JOB_NOT_OPEN' });
  });

  it('rejects duplicate applications from the same candidate', async () => {
    const jobId = await makeOpenJob();
    const cand = await makeCandidate();
    const first = await submitApplication({
      jobId, candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'r1.pdf', customAnswers: {} },
    });
    expect(first.ok).toBe(true);
    const second = await submitApplication({
      jobId, candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'r2.pdf', customAnswers: {} },
    });
    expect(second).toEqual({ ok: false, reason: 'ALREADY_APPLIED' });
  });

  it('validates custom answers against the job questions', async () => {
    const jobId = await makeOpenJob({
      customQuestions: [{ id: 'q1', type: 'SHORT_TEXT', label: 'Where?', required: true }],
    });
    const cand = await makeCandidate();
    const r = await submitApplication({
      jobId, candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    expect(r).toEqual({ ok: false, reason: 'INVALID_ANSWERS' });

    const ok = await submitApplication({
      jobId, candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'r.pdf', customAnswers: { q1: 'Berlin' } },
    });
    expect(ok.ok).toBe(true);
  });
});

describe('listMyApplications', () => {
  beforeEach(() => resetDb());

  it('returns only the requesting candidate\'s applications with job info', async () => {
    const jobId = await makeOpenJob();
    const c1 = await makeCandidate('c1@x.com');
    const c2 = await makeCandidate('c2@x.com');
    await submitApplication({ jobId, candidateUserId: c1.id, input: { jobId, resumeUrl: 'r.pdf', customAnswers: {} } });
    await submitApplication({ jobId, candidateUserId: c2.id, input: { jobId, resumeUrl: 'r.pdf', customAnswers: {} } });

    const mine = await listMyApplications(c1.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.job.title).toBe('Software Engineer');
  });
});

describe('getApplicationForCandidate', () => {
  beforeEach(() => resetDb());

  it('returns the application if owned by candidate', async () => {
    const jobId = await makeOpenJob();
    const cand = await makeCandidate();
    const r = await submitApplication({
      jobId, candidateUserId: cand.id,
      input: { jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    if (!r.ok) throw new Error();
    const got = await getApplicationForCandidate(r.applicationId, cand.id);
    expect(got?.id).toBe(r.applicationId);
  });

  it('returns null if requested by a different user', async () => {
    const jobId = await makeOpenJob();
    const a = await makeCandidate('a@x.com');
    const b = await makeCandidate('b@x.com');
    const r = await submitApplication({
      jobId, candidateUserId: a.id,
      input: { jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    if (!r.ok) throw new Error();
    expect(await getApplicationForCandidate(r.applicationId, b.id)).toBeNull();
  });
});

describe('submitApplication — deadline + concurrency', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('rejects with DEADLINE_PASSED when job deadline is in the past', async () => {
    const hr = await makeHr();
    const created = await createJob({
      input: { ...baseJob, deadline: new Date(Date.now() + 60_000) }, // future at creation
      postedByUserId: hr.id,
    });
    if (!created.ok) throw new Error();
    await publishJob({ jobId: created.jobId, actorUserId: hr.id });

    // Force the deadline into the past via direct DB write (simulates time passing).
    await prisma.job.update({
      where: { id: created.jobId },
      data: { deadline: new Date(Date.now() - 1000) },
    });

    const cand = await makeCandidate();
    const r = await submitApplication({
      jobId: created.jobId,
      candidateUserId: cand.id,
      input: { jobId: created.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    expect(r).toEqual({ ok: false, reason: 'DEADLINE_PASSED' });
  });

  it('two concurrent submits from the same candidate: exactly one wins (P2002 caught)', async () => {
    const hr = await makeHr();
    const job = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!job.ok) throw new Error();
    await publishJob({ jobId: job.jobId, actorUserId: hr.id });
    const cand = await makeCandidate();

    const [a, b] = await Promise.all([
      submitApplication({
        jobId: job.jobId, candidateUserId: cand.id,
        input: { jobId: job.jobId, resumeUrl: 'r1.pdf', customAnswers: {} },
      }),
      submitApplication({
        jobId: job.jobId, candidateUserId: cand.id,
        input: { jobId: job.jobId, resumeUrl: 'r2.pdf', customAnswers: {} },
      }),
    ]);

    const wins = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: 'ALREADY_APPLIED' });
  });
});

describe('submitApplication auto-links a matching referral', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('links application <-> referral when a pending referral matches', async () => {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const j = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!j.ok) throw new Error();
    await publishJob({ jobId: j.jobId, actorUserId: hr.id });

    const emp = await prisma.user.create({ data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' } });
    const ref = await prisma.referral.create({
      data: { referringUserId: emp.id, jobId: j.jobId, candidateName: 'X', candidateEmail: 'x@x.com', relationship: 'r', status: 'CONTACTED' },
    });

    const cand = await prisma.user.create({
      data: { email: 'x@x.com', name: 'X', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    __resetTransportForTests();
    const r = await submitApplication({
      jobId: j.jobId, candidateUserId: cand.id,
      input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const refAfter = await prisma.referral.findUniqueOrThrow({ where: { id: ref.id } });
    expect(refAfter.applicationId).toBe(r.applicationId);
    expect(refAfter.status).toBe('CONVERTED');

    const appAfter = await prisma.application.findUniqueOrThrow({ where: { id: r.applicationId } });
    expect(appAfter.referralId).toBe(ref.id);

    // 2 emails: candidate (application-received) + referrer (referral-status-update)
    const sends = __recordedSendsForTests();
    expect(sends.length).toBe(2);
    expect(sends.some((s) => s.to === cand.email)).toBe(true);
    expect(sends.some((s) => s.to === emp.email)).toBe(true);
  });
});
