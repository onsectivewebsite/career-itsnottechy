import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import { submitApplication } from './applicationService';
import { checkFileAcl } from './fileAclService';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'Requirements here',
  customQuestions: [], currency: 'USD',
};

async function setupApp() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });
  const cand = await prisma.user.create({
    data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
  const a = await submitApplication({
    jobId: j.jobId, candidateUserId: cand.id,
    input: { jobId: j.jobId, resumeUrl: 'resume/app/cand-resume.pdf', customAnswers: {} },
  });
  if (!a.ok) throw new Error();
  return { hr, cand, applicationId: a.applicationId, jobId: j.jobId };
}

describe('checkFileAcl', () => {
  beforeEach(() => resetDb());

  it('SUPER_ADMIN may read any path', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    expect(await checkFileAcl({ path: 'resume/x/y.pdf', user: { id: admin.id, role: 'SUPER_ADMIN' } }))
      .toEqual({ allowed: true });
  });

  it('HR_MANAGER may read any path', async () => {
    const hr = await prisma.user.create({ data: { email: 'h@x.com', name: 'H', role: 'HR_MANAGER' } });
    expect(await checkFileAcl({ path: 'resume/x/y.pdf', user: { id: hr.id, role: 'HR_MANAGER' } }))
      .toEqual({ allowed: true });
  });

  it('candidate may read THEIR resume but not others\'', async () => {
    const { cand } = await setupApp();
    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: cand.id, role: 'CANDIDATE' } }))
      .toEqual({ allowed: true });

    const other = await prisma.user.create({
      data: { email: 'o@x.com', name: 'O', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: other.id, role: 'CANDIDATE' } }))
      .toEqual({ allowed: false, reason: 'FORBIDDEN' });
  });

  it('referring employee may read the resume on a linked referral', async () => {
    const { applicationId, cand, jobId } = await setupApp();
    const emp = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    const ref = await prisma.referral.create({
      data: { referringUserId: emp.id, jobId, candidateName: 'Cand', candidateEmail: cand.email, relationship: 'colleague', status: 'CONVERTED' },
    });
    await prisma.application.update({ where: { id: applicationId }, data: { referralId: ref.id } });
    await prisma.referral.update({ where: { id: ref.id }, data: { applicationId } });

    expect(await checkFileAcl({ path: 'resume/app/cand-resume.pdf', user: { id: emp.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: true });
  });

  it('promotion submitter and assigned manager may read the supporting doc', async () => {
    const mgrUser = await prisma.user.create({ data: { email: 'm@x.com', name: 'M', role: 'MANAGER' } });
    const mgrEmp = await prisma.employee.create({
      data: { userId: mgrUser.id, employeeCode: 'M01', department: 'X', title: 'M', hireDate: new Date() },
    });
    const empUser = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    await prisma.employee.create({
      data: { userId: empUser.id, employeeCode: 'E01', department: 'X', title: 'E2', hireDate: new Date(), managerId: mgrEmp.id },
    });
    await prisma.promotionRequest.create({
      data: {
        employeeUserId: empUser.id, managerUserId: mgrUser.id,
        currentTitle: 'A', targetTitle: 'B', justification: 'long enough justification text',
        supportingDocUrl: 'supporting-doc/promotion/doc.pdf', finalStatus: 'PENDING_MANAGER',
      },
    });

    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: empUser.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: true });
    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: mgrUser.id, role: 'MANAGER' } }))
      .toEqual({ allowed: true });

    const stranger = await prisma.user.create({ data: { email: 's@x.com', name: 'S', role: 'EMPLOYEE' } });
    expect(await checkFileAcl({ path: 'supporting-doc/promotion/doc.pdf', user: { id: stranger.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: false, reason: 'FORBIDDEN' });
  });

  it('orphan path returns NOT_FOUND for non-HR/admin users', async () => {
    const u = await prisma.user.create({ data: { email: 'x@x.com', name: 'X', role: 'EMPLOYEE' } });
    expect(await checkFileAcl({ path: 'resume/nobody.pdf', user: { id: u.id, role: 'EMPLOYEE' } }))
      .toEqual({ allowed: false, reason: 'NOT_FOUND' });
  });
});

describe('checkFileAcl — application documents', () => {
  beforeEach(() => resetDb());

  async function makeDoc() {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE' } });
    const job = await prisma.job.create({
      data: {
        title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
        description: 'A description long enough to be valid.', requirements: 'Reqs.',
        status: 'OPEN', postedById: hr.id,
      },
    });
    const app = await prisma.application.create({
      data: { jobId: job.id, candidateUserId: cand.id, stage: 'APPLIED', resumeUrl: 'r.pdf' },
    });
    await prisma.applicationDocument.create({
      data: { applicationId: app.id, label: 'Portfolio', fileUrl: 'applications/a/documents/p.pdf', status: 'SUBMITTED' },
    });
    return { cand };
  }

  it('allows the owning candidate', async () => {
    const { cand } = await makeDoc();
    const r = await checkFileAcl({
      path: 'applications/a/documents/p.pdf',
      user: { id: cand.id, role: 'CANDIDATE' },
    });
    expect(r).toEqual({ allowed: true });
  });

  it('forbids a different candidate', async () => {
    await makeDoc();
    const other = await prisma.user.create({ data: { email: 'o@x.com', name: 'O', role: 'CANDIDATE' } });
    const r = await checkFileAcl({
      path: 'applications/a/documents/p.pdf',
      user: { id: other.id, role: 'CANDIDATE' },
    });
    expect(r).toEqual({ allowed: false, reason: 'FORBIDDEN' });
  });
});
