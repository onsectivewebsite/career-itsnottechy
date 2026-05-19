import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import { submitApplication } from './applicationService';
import {
  scheduleInterview,
  listInterviewsForUser,
  listInterviewsForApplication,
  cancelInterview,
} from './interviewService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'Requirements here',
  customQuestions: [], currency: 'USD',
};

const futureIso = (offsetDays = 7) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString();

async function setupApp() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });

  const cand = await prisma.user.create({
    data: { email: 'cand@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
  const a = await submitApplication({
    jobId: j.jobId, candidateUserId: cand.id,
    input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
  });
  if (!a.ok) throw new Error();

  const interviewer = await prisma.user.create({
    data: { email: 'iw@x.com', name: 'Iw', role: 'EMPLOYEE' },
  });
  return { hr, jobId: j.jobId, candidate: cand, applicationId: a.applicationId, interviewer };
}

describe('scheduleInterview', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates interview, emails candidate + interviewer with .ics attachments, records audit', async () => {
    const { hr, applicationId, interviewer, candidate } = await setupApp();
    __resetTransportForTests();

    const r = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/abc',
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.interview.findUniqueOrThrow({ where: { id: r.interviewId } });
    expect(created.status).toBe('SCHEDULED');
    expect(created.interviewerUserId).toBe(interviewer.id);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(2);
    const toEmails = sends.map((s) => s.to).sort();
    expect(toEmails).toEqual([candidate.email, interviewer.email].sort());
    for (const s of sends) {
      expect(s.attachments).toBeDefined();
      expect(s.attachments?.[0]).toMatchObject({
        contentType: expect.stringContaining('text/calendar'),
      });
      const filename = (s.attachments?.[0] as { filename: string }).filename;
      expect(filename).toMatch(/^interview-.+\.ics$/);
    }

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'INTERVIEW_SCHEDULED')).toBe(true);
  });

  it('returns CONFLICT when interviewer already has an overlapping slot and force is not set', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const first = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    expect(first.ok).toBe(true);

    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('CONFLICT');
    if (second.reason !== 'CONFLICT') return;
    expect(second.conflicts).toHaveLength(1);
    expect(second.conflicts[0]?.id).toBe(first.ok ? first.interviewId : '');
  });

  it('force=true bypasses the conflict check and schedules anyway', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      force: true,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(true);
  });

  it('CANCELLED interviews are ignored in conflict check', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const first = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    if (!first.ok) throw new Error();
    await cancelInterview({ interviewId: first.interviewId, actorUserId: hr.id });

    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(true);
  });

  it('returns NOT_FOUND when applicationId does not exist', async () => {
    const { hr, interviewer } = await setupApp();
    const r = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId: 'nope', scheduledAt: futureIso(7), durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: 'x',
      },
    });
    expect(r).toMatchObject({ ok: false, reason: 'NOT_FOUND' });
  });

  it('two concurrent schedules for the same interviewer: exactly one wins', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const at = futureIso(10);

    const [a, b] = await Promise.all([
      scheduleInterview({
        scheduledByUserId: hr.id,
        input: {
          applicationId, scheduledAt: at, durationMinutes: 60,
          format: 'VIDEO', interviewerUserId: interviewer.id,
          locationOrLink: 'https://meet.example.com/a',
        },
      }),
      scheduleInterview({
        scheduledByUserId: hr.id,
        input: {
          applicationId, scheduledAt: at, durationMinutes: 30,
          format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555',
        },
      }),
    ]);

    const wins   = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    if (losses[0]!.ok) return;
    expect(losses[0]!.reason).toBe('CONFLICT');

    const all = await prisma.interview.findMany({ where: { interviewerUserId: interviewer.id } });
    expect(all).toHaveLength(1);
  });
});

describe('listInterviewsForUser', () => {
  beforeEach(() => resetDb());

  it('returns interviews where user is candidate OR interviewer, future first', async () => {
    const { hr, applicationId, interviewer, candidate } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });

    const forCandidate = await listInterviewsForUser(candidate.id);
    expect(forCandidate).toHaveLength(1);
    expect(forCandidate[0]?.application.job.title).toBe('Software Engineer');

    const forInterviewer = await listInterviewsForUser(interviewer.id);
    expect(forInterviewer).toHaveLength(1);
  });

  it('returns empty array for an unrelated user', async () => {
    const { hr } = await setupApp();
    expect(await listInterviewsForUser(hr.id)).toEqual([]);
  });
});

describe('listInterviewsForApplication', () => {
  beforeEach(() => resetDb());

  it('returns interviews for the application ordered by scheduledAt asc', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(14), durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1',
      },
    });
    await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });

    const list = await listInterviewsForApplication(applicationId);
    expect(list).toHaveLength(2);
    expect(list[0]!.scheduledAt.getTime()).toBeLessThan(list[1]!.scheduledAt.getTime());
  });
});

describe('cancelInterview', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('flips status to CANCELLED and writes audit', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const r = await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });
    if (!r.ok) throw new Error();

    const c = await cancelInterview({ interviewId: r.interviewId, actorUserId: hr.id });
    expect(c.ok).toBe(true);

    const after = await prisma.interview.findUniqueOrThrow({ where: { id: r.interviewId } });
    expect(after.status).toBe('CANCELLED');

    const audits = await prisma.auditLog.findMany({ where: { action: 'INTERVIEW_CANCELLED' } });
    expect(audits).toHaveLength(1);
  });

  it('returns NOT_FOUND for unknown id', async () => {
    const r = await cancelInterview({ interviewId: 'nope', actorUserId: 'x' });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});
