import { beforeEach, describe, expect, it } from 'vitest';
import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import { submitApplication } from './applicationService';
import { isValidTransition, moveStage, getApplicationForHr, listApplicationsForJob } from './atsService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'requirements',
  customQuestions: [], currency: 'USD',
};

async function setupOpenJobWithApplication() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });
  const cand = await prisma.user.create({
    data: { email: 'c@x.com', name: 'Candidate', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
  const a = await submitApplication({
    jobId: j.jobId, candidateUserId: cand.id,
    input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
  });
  if (!a.ok) throw new Error();
  return { hr, jobId: j.jobId, candidateId: cand.id, applicationId: a.applicationId };
}

describe('isValidTransition', () => {
  it('APPLIED -> SCREENING is allowed', () => {
    expect(isValidTransition('APPLIED', 'SCREENING')).toBe(true);
  });
  it('APPLIED -> OFFER is NOT allowed', () => {
    expect(isValidTransition('APPLIED', 'OFFER')).toBe(false);
  });
  it('any non-terminal stage -> REJECTED is allowed', () => {
    const stages: AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER'];
    for (const s of stages) expect(isValidTransition(s, 'REJECTED')).toBe(true);
  });
  it('HIRED is terminal', () => {
    expect(isValidTransition('HIRED', 'REJECTED')).toBe(false);
    expect(isValidTransition('HIRED', 'OFFER')).toBe(false);
  });
  it('REJECTED is terminal', () => {
    expect(isValidTransition('REJECTED', 'APPLIED')).toBe(false);
  });
  it('same stage is NOT a valid transition (no-op)', () => {
    expect(isValidTransition('APPLIED', 'APPLIED')).toBe(false);
  });
});

describe('moveStage', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('moves APPLIED -> SCREENING, fires status-changed email, records audit', async () => {
    const { hr, applicationId } = await setupOpenJobWithApplication();
    __resetTransportForTests();
    const r = await moveStage({ applicationId, toStage: 'SCREENING', actorUserId: hr.id });
    expect(r.ok).toBe(true);

    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(app?.stage).toBe('SCREENING');

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.subject).toContain('Screening');

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'APP_STAGE_CHANGED')).toBe(true);
  });

  it('moves INTERVIEW -> OFFER, fires offer-sent template (not status-changed)', async () => {
    const { hr, applicationId } = await setupOpenJobWithApplication();
    await moveStage({ applicationId, toStage: 'SCREENING', actorUserId: hr.id });
    await moveStage({ applicationId, toStage: 'INTERVIEW', actorUserId: hr.id });
    __resetTransportForTests();
    const r = await moveStage({ applicationId, toStage: 'OFFER', actorUserId: hr.id });
    expect(r.ok).toBe(true);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.subject.toLowerCase()).toContain('offer');
  });

  it('refuses an illegal transition with INVALID_TRANSITION', async () => {
    const { hr, applicationId } = await setupOpenJobWithApplication();
    const r = await moveStage({ applicationId, toStage: 'OFFER', actorUserId: hr.id });
    expect(r).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
  });

  it('NOT_FOUND for unknown application', async () => {
    const hr = await prisma.user.create({ data: { email: 'h@x.com', name: 'H', role: 'HR_MANAGER' } });
    const r = await moveStage({ applicationId: 'nope', toStage: 'SCREENING', actorUserId: hr.id });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('two concurrent moves from APPLIED: exactly one wins, audit has one row', async () => {
    const { hr, applicationId } = await setupOpenJobWithApplication();
    __resetTransportForTests();

    const [a, b] = await Promise.all([
      moveStage({ applicationId, toStage: 'SCREENING', actorUserId: hr.id }),
      moveStage({ applicationId, toStage: 'REJECTED',  actorUserId: hr.id }),
    ]);

    const wins   = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });

    // Only one audit row for the stage change, not two.
    const audits = await prisma.auditLog.findMany({ where: { action: 'APP_STAGE_CHANGED' } });
    expect(audits).toHaveLength(1);

    // Only one outgoing email, not two.
    expect(__recordedSendsForTests()).toHaveLength(1);
  });
});

describe('getApplicationForHr', () => {
  beforeEach(() => resetDb());

  it('returns application with job, candidate, profile, notes', async () => {
    const { applicationId } = await setupOpenJobWithApplication();
    const got = await getApplicationForHr(applicationId);
    expect(got?.candidate.email).toBe('c@x.com');
    expect(got?.job.title).toBe('Software Engineer');
    expect(got?.notes).toEqual([]);
  });

  it('returns null for unknown id', async () => {
    expect(await getApplicationForHr('nope')).toBeNull();
  });
});

describe('listApplicationsForJob', () => {
  beforeEach(() => resetDb());

  it('returns all applications for a job', async () => {
    const { jobId } = await setupOpenJobWithApplication();
    const list = await listApplicationsForJob(jobId);
    expect(list).toHaveLength(1);
    expect(list[0]?.stage).toBe('APPLIED');
  });
});
