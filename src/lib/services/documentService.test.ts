import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import type { RequiredDocument } from '@/types/requiredDocuments';
import {
  missingRequiredDocuments,
  createAppliedDocuments,
  listApplicationDocuments,
} from './documentService';

const REQ: RequiredDocument[] = [
  { id: 'd1', name: 'Portfolio', required: true },
  { id: 'd2', name: 'Cover note', required: false },
];

async function makeApplication() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE' } });
  const job = await prisma.job.create({
    data: {
      title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'A description long enough to be valid.', requirements: 'Reqs.',
      status: 'OPEN', postedById: hr.id,
    },
  });
  const app = await prisma.application.create({
    data: { jobId: job.id, candidateUserId: cand.id, stage: 'APPLIED', resumeUrl: 'resume.pdf' },
  });
  return { hr, cand, job, app };
}

describe('missingRequiredDocuments', () => {
  it('returns required docs that have no file', () => {
    const missing = missingRequiredDocuments(REQ, { d2: 'note.pdf' });
    expect(missing.map((d) => d.id)).toEqual(['d1']);
  });

  it('returns nothing when all required docs are provided', () => {
    expect(missingRequiredDocuments(REQ, { d1: 'p.pdf' })).toEqual([]);
  });
});

describe('createAppliedDocuments', () => {
  beforeEach(() => resetDb());

  it('creates SUBMITTED rows only for provided documents', async () => {
    const { app } = await makeApplication();
    await createAppliedDocuments({
      applicationId: app.id,
      requiredDocuments: REQ,
      provided: { d1: 'applications/x/documents/portfolio.pdf' },
    });
    const docs = await listApplicationDocuments(app.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.label).toBe('Portfolio');
    expect(docs[0]?.status).toBe('SUBMITTED');
    expect(docs[0]?.fileUrl).toBe('applications/x/documents/portfolio.pdf');
    expect(docs[0]?.requestedById).toBeNull();
  });
});
