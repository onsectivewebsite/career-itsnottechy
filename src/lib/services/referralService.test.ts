import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import {
  submitReferral,
  listMyReferrals,
  listAllReferrals,
  autoLinkOnCandidateRegistered,
  notifyReferrerOnStageChange,
} from './referralService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'Requirements here',
  customQuestions: [], currency: 'USD',
};

async function setupOpenJob() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });
  return { hr, jobId: j.jobId };
}

async function makeEmployee(email = 'emp@x.com') {
  return prisma.user.create({ data: { email, name: 'Emp', role: 'EMPLOYEE' } });
}

describe('submitReferral', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates a referral, emails referrer + HR group, records audit', async () => {
    const { hr, jobId } = await setupOpenJob();
    const emp = await makeEmployee();
    const r = await submitReferral({
      referringUserId: emp.id,
      input: {
        jobId,
        candidateName: 'Jordan Reed',
        candidateEmail: 'jordan@example.com',
        relationship: 'Former colleague',
      },
    });
    expect(r.ok).toBe(true);

    const refs = await prisma.referral.findMany();
    expect(refs).toHaveLength(1);
    expect(refs[0]?.status).toBe('SUBMITTED');
    expect(refs[0]?.candidateEmail).toBe('jordan@example.com');

    const sends = __recordedSendsForTests();
    expect(sends.length).toBe(2);
    expect(sends.some((s) => s.to === emp.email)).toBe(true);
    expect(sends.some((s) => s.to === hr.email)).toBe(true);

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'REFERRAL_SUBMITTED')).toBe(true);
  });

  it('rejects when the job is not OPEN', async () => {
    const emp = await makeEmployee();
    const hr = await prisma.user.create({ data: { email: 'hr2@x.com', name: 'HR2', role: 'HR_MANAGER' } });
    const j = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!j.ok) throw new Error();
    const r = await submitReferral({
      referringUserId: emp.id,
      input: { jobId: j.jobId, candidateName: 'X', candidateEmail: 'x@x.com', relationship: 'x' },
    });
    expect(r).toEqual({ ok: false, reason: 'JOB_NOT_OPEN' });
  });

  it('rejects duplicate referral (same employee + email + job)', async () => {
    const { jobId } = await setupOpenJob();
    const emp = await makeEmployee();
    const input = { jobId, candidateName: 'A', candidateEmail: 'a@x.com', relationship: 'x' };
    expect((await submitReferral({ referringUserId: emp.id, input })).ok).toBe(true);
    const r = await submitReferral({ referringUserId: emp.id, input });
    expect(r).toEqual({ ok: false, reason: 'DUPLICATE' });
  });
});

describe('listMyReferrals / listAllReferrals', () => {
  beforeEach(() => resetDb());

  it('listMyReferrals scopes to the referring user', async () => {
    const { jobId } = await setupOpenJob();
    const e1 = await makeEmployee('e1@x.com');
    const e2 = await makeEmployee('e2@x.com');
    await submitReferral({ referringUserId: e1.id, input: { jobId, candidateName: 'A', candidateEmail: 'a@x.com', relationship: 'r' } });
    await submitReferral({ referringUserId: e2.id, input: { jobId, candidateName: 'B', candidateEmail: 'b@x.com', relationship: 'r' } });

    const mine = await listMyReferrals(e1.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.candidateEmail).toBe('a@x.com');
  });

  it('listAllReferrals returns referrals with job + referrer + linked-application', async () => {
    const { jobId } = await setupOpenJob();
    const e1 = await makeEmployee();
    await submitReferral({ referringUserId: e1.id, input: { jobId, candidateName: 'A', candidateEmail: 'a@x.com', relationship: 'r' } });
    const all = await listAllReferrals();
    expect(all).toHaveLength(1);
    expect(all[0]?.referringUser.email).toBe('emp@x.com');
    expect(all[0]?.job.title).toBe('Software Engineer');
  });
});

describe('autoLinkOnCandidateRegistered', () => {
  beforeEach(() => resetDb());

  it('marks matching pending referral as CONTACTED', async () => {
    const { jobId } = await setupOpenJob();
    const emp = await makeEmployee();
    await submitReferral({ referringUserId: emp.id, input: { jobId, candidateName: 'New Hire', candidateEmail: 'newhire@x.com', relationship: 'friend' } });

    const cand = await prisma.user.create({
      data: { email: 'newhire@x.com', name: 'New Hire', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    await autoLinkOnCandidateRegistered({ candidateUserId: cand.id });

    const ref = await prisma.referral.findFirst({ where: { candidateEmail: 'newhire@x.com' } });
    expect(ref?.status).toBe('CONTACTED');
  });

  it('is idempotent / no-op when no referral matches', async () => {
    const cand = await prisma.user.create({ data: { email: 'nobody@x.com', name: 'No', role: 'CANDIDATE' } });
    await autoLinkOnCandidateRegistered({ candidateUserId: cand.id });
    expect(await prisma.referral.findMany()).toHaveLength(0);
  });
});

describe('notifyReferrerOnStageChange', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('emails the referrer with the new stage when an application has a referral', async () => {
    const { jobId } = await setupOpenJob();
    const emp = await makeEmployee();
    await submitReferral({ referringUserId: emp.id, input: { jobId, candidateName: 'C', candidateEmail: 'c@x.com', relationship: 'r' } });
    const cand = await prisma.user.create({
      data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const ref = await prisma.referral.findFirstOrThrow({ where: { candidateEmail: 'c@x.com' } });
    const app = await prisma.application.create({
      data: { jobId, candidateUserId: cand.id, resumeUrl: 'r.pdf', referralId: ref.id },
    });

    __resetTransportForTests();
    await notifyReferrerOnStageChange({ applicationId: app.id, newStage: 'SCREENING' });
    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.to).toBe(emp.email);
    expect(sends[0]?.subject).toContain('Screening');
  });

  it('no-op when application has no referral', async () => {
    const { jobId } = await setupOpenJob();
    const cand = await prisma.user.create({ data: { email: 'plain@x.com', name: 'C', role: 'CANDIDATE' } });
    const app = await prisma.application.create({
      data: { jobId, candidateUserId: cand.id, resumeUrl: 'r.pdf' },
    });
    __resetTransportForTests();
    await notifyReferrerOnStageChange({ applicationId: app.id, newStage: 'SCREENING' });
    expect(__recordedSendsForTests()).toHaveLength(0);
  });

  it('bumps referral.status to CONVERTED on the first forward stage move', async () => {
    const { jobId } = await setupOpenJob();
    const emp = await makeEmployee();
    await submitReferral({ referringUserId: emp.id, input: { jobId, candidateName: 'C', candidateEmail: 'c@x.com', relationship: 'r' } });
    const cand = await prisma.user.create({
      data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const ref = await prisma.referral.findFirstOrThrow({ where: { candidateEmail: 'c@x.com' } });
    const app = await prisma.application.create({
      data: { jobId, candidateUserId: cand.id, resumeUrl: 'r.pdf', referralId: ref.id },
    });
    await notifyReferrerOnStageChange({ applicationId: app.id, newStage: 'SCREENING' });

    const after = await prisma.referral.findUniqueOrThrow({ where: { id: ref.id } });
    expect(after.status).toBe('CONVERTED');
  });
});
