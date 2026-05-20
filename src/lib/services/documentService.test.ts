import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import type { RequiredDocument } from '@/types/requiredDocuments';
import {
  missingRequiredDocuments,
  createAppliedDocuments,
  listApplicationDocuments,
  requestDocument,
  fulfilDocumentRequest,
  listPendingDocumentsForCandidate,
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

describe('requestDocument', () => {
  beforeEach(() => resetDb());

  it('creates a PENDING document and an audit row', async () => {
    const { hr, app } = await makeApplication();
    const r = await requestDocument({
      applicationId: app.id,
      requestedById: hr.id,
      name: 'Government ID',
      instructions: 'A clear photo or scan',
    });
    expect(r.ok).toBe(true);
    const docs = await listApplicationDocuments(app.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.status).toBe('PENDING');
    expect(docs[0]?.fileUrl).toBeNull();
    expect(docs[0]?.requestedById).toBe(hr.id);
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'DOCUMENT_REQUESTED')).toBe(true);
  });

  it('returns APPLICATION_NOT_FOUND for an unknown application', async () => {
    const { hr } = await makeApplication();
    const r = await requestDocument({ applicationId: 'nope', requestedById: hr.id, name: 'X' });
    expect(r).toEqual({ ok: false, reason: 'APPLICATION_NOT_FOUND' });
  });
});

describe('fulfilDocumentRequest', () => {
  beforeEach(() => resetDb());

  it('sets the file and flips status to SUBMITTED', async () => {
    const { hr, cand, app } = await makeApplication();
    const req = await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    if (!req.ok) throw new Error();
    const r = await fulfilDocumentRequest({
      documentId: req.documentId,
      candidateUserId: cand.id,
      fileUrl: 'applications/x/documents/id.pdf',
    });
    expect(r).toEqual({ ok: true });
    const docs = await listApplicationDocuments(app.id);
    expect(docs[0]?.status).toBe('SUBMITTED');
    expect(docs[0]?.fileUrl).toBe('applications/x/documents/id.pdf');
  });

  it('rejects a candidate who does not own the application', async () => {
    const { hr, app } = await makeApplication();
    const intruder = await prisma.user.create({ data: { email: 'i@x.com', name: 'I', role: 'CANDIDATE' } });
    const req = await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    if (!req.ok) throw new Error();
    const r = await fulfilDocumentRequest({
      documentId: req.documentId, candidateUserId: intruder.id, fileUrl: 'x.pdf',
    });
    expect(r).toEqual({ ok: false, reason: 'FORBIDDEN' });
  });
});

describe('listPendingDocumentsForCandidate', () => {
  beforeEach(() => resetDb());

  it('returns only this candidate’s PENDING documents', async () => {
    const { hr, cand, app } = await makeApplication();
    await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    const pending = await listPendingDocumentsForCandidate(cand.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.label).toBe('ID');
    expect(pending[0]?.application.job.title).toBe('Designer');
  });
});
