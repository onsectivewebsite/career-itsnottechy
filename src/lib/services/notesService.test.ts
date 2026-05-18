import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { addApplicationNote, listApplicationNotes } from './notesService';

async function setupNotableApp() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE' } });
  const job = await prisma.job.create({
    data: {
      title: 'J', department: 'D', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'd', requirements: 'r', postedById: hr.id, status: 'OPEN',
    },
  });
  const app = await prisma.application.create({
    data: { jobId: job.id, candidateUserId: cand.id, resumeUrl: 'r.pdf' },
  });
  return { hr, app };
}

describe('addApplicationNote', () => {
  beforeEach(() => resetDb());

  it('creates a note with author + body', async () => {
    const { hr, app } = await setupNotableApp();
    const r = await addApplicationNote({
      applicationId: app.id, authorUserId: hr.id, body: 'Looks promising.',
    });
    expect(r.ok).toBe(true);
    const notes = await prisma.applicationNote.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toBe('Looks promising.');
  });

  it('rejects empty body (whitespace only)', async () => {
    const { hr, app } = await setupNotableApp();
    const r = await addApplicationNote({
      applicationId: app.id, authorUserId: hr.id, body: '   ',
    });
    expect(r).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('trims surrounding whitespace', async () => {
    const { hr, app } = await setupNotableApp();
    const r = await addApplicationNote({
      applicationId: app.id, authorUserId: hr.id, body: '  hello  ',
    });
    expect(r.ok).toBe(true);
    const notes = await prisma.applicationNote.findMany();
    expect(notes[0]?.body).toBe('hello');
  });

  it('records audit', async () => {
    const { hr, app } = await setupNotableApp();
    await addApplicationNote({ applicationId: app.id, authorUserId: hr.id, body: 'A note.' });
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'APP_NOTE_ADDED')).toBe(true);
  });
});

describe('listApplicationNotes', () => {
  beforeEach(() => resetDb());

  it('returns notes newest-first with author', async () => {
    const { hr, app } = await setupNotableApp();
    await addApplicationNote({ applicationId: app.id, authorUserId: hr.id, body: 'first' });
    await new Promise((r) => setTimeout(r, 10));
    await addApplicationNote({ applicationId: app.id, authorUserId: hr.id, body: 'second' });
    const notes = await listApplicationNotes(app.id);
    expect(notes[0]?.body).toBe('second');
    expect(notes[0]?.author.name).toBe('HR');
  });
});
