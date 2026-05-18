# Phase 3 — ATS Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR sees a Kanban-style applicant tracker per job (6 columns, one per `AppStage`), can drag/move applications between stages with valid-transition enforcement, can read full candidate profile per application, can add internal notes. Status-change emails fire to the candidate at every stage move; the OFFER stage uses a dedicated "offer sent" template. Candidate dashboard auto-reflects the new stage.

**Architecture:** Service layer `atsService` owns transition rules and stage moves. HR pages live under `/dashboard/hr/jobs/[id]/applicants` (table) and `/dashboard/hr/applications/[id]` (per-application detail with notes thread). Stage moves are server actions (no drag-drop in MVP — clean "Move to" dropdown action is the v1; drag/drop is a v2 enhancement). Notes are a separate service + form action.

**Tech Stack:** Same as Phase 1+2.

**Prerequisites:** Phase 2 complete (tag `phase-2-complete`). 137 tests passing.

**End-of-plan state:** HR can manage the full applicant lifecycle for any job; candidates get an email at every transition; ~160 tests passing total. Two new email templates registered.

---

## Task 1: Stage transition rules + atsService.moveStage

**Files:**
- Create: `src/lib/services/atsService.ts`, `src/lib/services/atsService.test.ts`

The `AppStage` enum: `APPLIED | SCREENING | INTERVIEW | OFFER | HIRED | REJECTED`. Valid transitions:

- `APPLIED` → `SCREENING | REJECTED`
- `SCREENING` → `INTERVIEW | REJECTED`
- `INTERVIEW` → `OFFER | REJECTED`
- `OFFER` → `HIRED | REJECTED`
- `HIRED` — terminal
- `REJECTED` — terminal

Plus a global "reset to earlier stage" override (`allowReverse: true`) that lets HR move backward — useful when someone is mistakenly rejected. Tests cover both directions.

- [ ] **Step 1: Write failing tests**

`src/lib/services/atsService.test.ts`:
```ts
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
  it('APPLIED -> OFFER is NOT allowed (must screen first)', () => {
    expect(isValidTransition('APPLIED', 'OFFER')).toBe(false);
  });
  it('any stage -> REJECTED is allowed', () => {
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
    __resetTransportForTests();
    await moveStage({ applicationId, toStage: 'INTERVIEW', actorUserId: hr.id });
    __resetTransportForTests();
    const r = await moveStage({ applicationId, toStage: 'OFFER', actorUserId: hr.id });
    expect(r.ok).toBe(true);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.subject).toContain('offer');
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

  it('returns all applications for a job grouped by stage in result', async () => {
    const { jobId } = await setupOpenJobWithApplication();
    const list = await listApplicationsForJob(jobId);
    expect(list).toHaveLength(1);
    expect(list[0]?.stage).toBe('APPLIED');
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm test -- src/lib/services/atsService.test.ts
```

- [ ] **Step 3: Implement** (also extend the email template registry with two new templates — `application-status-changed` and `offer-sent` — and add the HTML files; do it as part of this commit so the service can wire emails immediately)

Create `src/emails/templates/application-status-changed.html`:
```html
<p>Hi {{name}},</p>
<p>An update on your application for <strong>{{jobTitle}}</strong>:</p>
<p>Your application has moved to <strong>{{stageLabel}}</strong>.</p>
<p>{{stageBlurb}}</p>
<p><a class="btn" href="{{dashboardUrl}}">Open my dashboard</a></p>
```

Create `src/emails/templates/offer-sent.html`:
```html
<p>Hi {{name}},</p>
<p>We&apos;d like to make you an offer for <strong>{{jobTitle}}</strong>.</p>
<p>Our HR team will be in touch shortly with the formal offer letter and next steps.</p>
<p><a class="btn" href="{{dashboardUrl}}">Open my dashboard</a></p>
```

Extend `src/lib/email/templates.ts`. Inside `TemplateData`, add:
```ts
  'application-status-changed': { name: string; jobTitle: string; stageLabel: string; stageBlurb: string; dashboardUrl: string };
  'offer-sent':                 { name: string; jobTitle: string; dashboardUrl: string };
```

Inside `subjects`, add:
```ts
  'application-status-changed': (data) => `${data.jobTitle}: ${data.stageLabel}`,
  'offer-sent':                 (data) => `An offer for ${data.jobTitle}`,
```

Create `src/lib/services/atsService.ts`:
```ts
import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

const FORWARD: Record<AppStage, AppStage[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
};

export function isValidTransition(from: AppStage, to: AppStage): boolean {
  if (from === to) return false;
  return FORWARD[from].includes(to);
}

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED:   'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER:     'Offer extended',
  HIRED:     'Hired',
  REJECTED:  'Not moving forward',
};

const STAGE_BLURB: Record<AppStage, string> = {
  APPLIED:   'We received your application and will review it shortly.',
  SCREENING: 'Our team is reviewing your background in detail.',
  INTERVIEW: 'You will be invited to an interview shortly — watch for a scheduling email.',
  OFFER:     '',  // handled by the offer-sent template instead
  HIRED:     'Welcome to ItsNotTechy. Our HR team will be in touch with next steps.',
  REJECTED:  'Thank you for your interest. We have decided not to move forward at this time.',
};

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' };

export async function moveStage(args: {
  applicationId: string;
  toStage: AppStage;
  actorUserId: string;
}): Promise<MoveResult> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: { job: true, candidate: true },
  });
  if (!app) return { ok: false, reason: 'NOT_FOUND' };
  if (!isValidTransition(app.stage, args.toStage)) {
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }

  await prisma.application.update({
    where: { id: args.applicationId },
    data: { stage: args.toStage },
  });

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'APP_STAGE_CHANGED',
    entityType: 'Application',
    entityId: args.applicationId,
    metadata: { from: app.stage, to: args.toStage },
  });

  const dashboardUrl = `${process.env.APP_URL ?? ''}/dashboard/candidate`;

  if (args.toStage === 'OFFER') {
    await sendEmail({
      to: app.candidate.email,
      template: 'offer-sent',
      data: { name: app.candidate.name, jobTitle: app.job.title, dashboardUrl },
    });
  } else {
    await sendEmail({
      to: app.candidate.email,
      template: 'application-status-changed',
      data: {
        name: app.candidate.name,
        jobTitle: app.job.title,
        stageLabel: STAGE_LABEL[args.toStage],
        stageBlurb: STAGE_BLURB[args.toStage],
        dashboardUrl,
      },
    });
  }

  return { ok: true };
}

export async function listApplicationsForJob(jobId: string) {
  return prisma.application.findMany({
    where: { jobId },
    orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    include: {
      candidate: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getApplicationForHr(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      candidate: { include: { candidateProfile: true } },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
      },
      referral: true,
    },
  });
}
```

- [ ] **Step 4: Run — should pass**

```bash
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm test -- src/lib/services/atsService.test.ts
```
Expected: all 13 atsService tests pass.

- [ ] **Step 5: Full suite**

```bash
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm test
```
Expected: 137 + 13 ≈ 150 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/atsService.ts src/lib/services/atsService.test.ts src/lib/email/templates.ts src/emails/templates/application-status-changed.html src/emails/templates/offer-sent.html
git commit -m "feat(ats): add atsService with stage transitions + status-change/offer emails"
```

---

## Task 2: applicationNotesService

**Files:**
- Create: `src/lib/services/notesService.ts`, `src/lib/services/notesService.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/services/notesService.test.ts`:
```ts
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

  it('rejects empty body', async () => {
    const { hr, app } = await setupNotableApp();
    const r = await addApplicationNote({
      applicationId: app.id, authorUserId: hr.id, body: '   ',
    });
    expect(r).toEqual({ ok: false, reason: 'EMPTY' });
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
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/services/notesService.ts`:
```ts
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export type AddNoteResult = { ok: true; noteId: string } | { ok: false; reason: 'EMPTY' };

export async function addApplicationNote(args: {
  applicationId: string; authorUserId: string; body: string;
}): Promise<AddNoteResult> {
  const trimmed = args.body.trim();
  if (trimmed === '') return { ok: false, reason: 'EMPTY' };

  const note = await prisma.applicationNote.create({
    data: {
      applicationId: args.applicationId,
      authorUserId: args.authorUserId,
      body: trimmed,
    },
  });
  await recordAudit({
    actorUserId: args.authorUserId,
    action: 'APP_NOTE_ADDED',
    entityType: 'Application',
    entityId: args.applicationId,
    metadata: { noteId: note.id },
  });
  return { ok: true, noteId: note.id };
}

export async function listApplicationNotes(applicationId: string) {
  return prisma.applicationNote.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, name: true } } },
  });
}
```

- [ ] **Step 4: Run + commit**

```bash
git add src/lib/services/notesService.ts src/lib/services/notesService.test.ts
git commit -m "feat(ats): add applicationNote service (add + list with audit)"
```

---

## Task 3: HR ATS actions

**Files:**
- Create: `src/app/dashboard/hr/applications/actions.ts`

- [ ] **Step 1: Implement**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { moveStage } from '@/lib/services/atsService';
import { addApplicationNote } from '@/lib/services/notesService';

type FormState = { error?: string; ok?: true };

const VALID_STAGES: readonly AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

function narrowStage(raw: unknown): AppStage | null {
  return typeof raw === 'string' && (VALID_STAGES as readonly string[]).includes(raw) ? (raw as AppStage) : null;
}

export async function moveStageAction(
  applicationId: string,
  jobId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const toStage = narrowStage(fd.get('toStage'));
  if (!toStage) return { error: 'Invalid stage.' };

  const r = await moveStage({ applicationId, toStage, actorUserId: user.id });
  if (!r.ok) {
    return {
      error: r.reason === 'NOT_FOUND'
        ? 'Application not found.'
        : 'That stage transition is not allowed from the current stage.',
    };
  }
  revalidatePath(`/dashboard/hr/jobs/${jobId}/applicants`);
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}

export async function addNoteAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const body = String(fd.get('body') ?? '');
  const r = await addApplicationNote({
    applicationId, authorUserId: user.id, body,
  });
  if (!r.ok) return { error: 'Note cannot be empty.' };
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/hr/applications/actions.ts
git commit -m "feat(ats): add stage-move + add-note server actions"
```

---

## Task 4: HR applicants list per job (table grouped by stage)

**Files:**
- Create: `src/app/dashboard/hr/jobs/[id]/applicants/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listApplicationsForJob } from '@/lib/services/atsService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const STAGE_ORDER: AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};

const STAGE_TONE: Record<AppStage, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const apps = await listApplicationsForJob(params.id);

  // Group by stage in canonical order
  const byStage: Record<AppStage, typeof apps> = {
    APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: [],
  };
  for (const a of apps) byStage[a.stage].push(a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/hr/jobs" className="text-sm text-brand-600 hover:underline">&larr; All jobs</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Applicants: {job.title}</h1>
          <p className="text-sm text-slate-500">{apps.length} application{apps.length === 1 ? '' : 's'} total</p>
        </div>
        <Link href={`/dashboard/hr/jobs/${params.id}`} className="text-sm text-slate-600 hover:text-slate-900">Edit job</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STAGE_ORDER.map((stage) => (
          <Card key={stage}>
            <div className="flex items-center justify-between">
              <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {byStage[stage].map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/dashboard/hr/applications/${app.id}`}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand-300 hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{app.candidate.name}</div>
                    <div className="text-xs text-slate-500">{app.candidate.email}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Applied {app.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </Link>
                </li>
              ))}
              {byStage[stage].length === 0 && (
                <li className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                  No one here.
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
git add "src/app/dashboard/hr/jobs/[id]/applicants/"
git commit -m "feat(hr): per-job applicants kanban view"
```

---

## Task 5: HR application detail page (stage controls + notes thread)

**Files:**
- Create: `src/app/dashboard/hr/applications/[id]/page.tsx`, `src/app/dashboard/hr/applications/[id]/StageActions.tsx`, `src/app/dashboard/hr/applications/[id]/NoteForm.tsx`

- [ ] **Step 1: StageActions (client wrapper for stage-move action)**

`src/app/dashboard/hr/applications/[id]/StageActions.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import type { AppStage } from '@prisma/client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { moveStageAction } from '../actions';

type FormState = { error?: string; ok?: true };

const NEXT_STAGES: Record<AppStage, AppStage[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
};

const LABEL: Record<AppStage, string> = {
  APPLIED: 'Move to Applied', SCREENING: 'Advance to Screening',
  INTERVIEW: 'Advance to Interview', OFFER: 'Extend Offer',
  HIRED: 'Mark as Hired', REJECTED: 'Reject',
};

export function StageActions({
  applicationId, jobId, currentStage,
}: { applicationId: string; jobId: string; currentStage: AppStage }) {
  const boundAction = moveStageAction.bind(null, applicationId, jobId);
  const [state, formAction] = useFormState(boundAction, {} as FormState);
  const next = NEXT_STAGES[currentStage];

  if (next.length === 0) {
    return <p className="text-sm text-slate-500">No further transitions from this stage.</p>;
  }

  return (
    <div className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {next.map((stage) => (
          <form key={stage} action={formAction}>
            <input type="hidden" name="toStage" value={stage} />
            <Button
              type="submit"
              variant={stage === 'REJECTED' ? 'danger' : 'primary'}
              size="sm"
            >
              {LABEL[stage]}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: NoteForm (client wrapper for add-note action)**

`src/app/dashboard/hr/applications/[id]/NoteForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { addNoteAction } from '../actions';

type FormState = { error?: string; ok?: true };

export function NoteForm({ applicationId }: { applicationId: string }) {
  const boundAction = addNoteAction.bind(null, applicationId);
  const [state, formAction] = useFormState(boundAction, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <textarea
        name="body"
        rows={3}
        placeholder="Add an internal note..."
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        required
      />
      <Button type="submit" size="sm">Post note</Button>
    </form>
  );
}
```

- [ ] **Step 3: Server detail page**

`src/app/dashboard/hr/applications/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { getApplicationForHr } from '@/lib/services/atsService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StageActions } from './StageActions';
import { NoteForm } from './NoteForm';
import type { CustomQuestion } from '@/types/customQuestions';

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};
const STAGE_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const app = await getApplicationForHr(params.id);
  if (!app) notFound();

  const questions = (app.job.customQuestions as unknown as CustomQuestion[]) ?? [];
  const answers = (app.customAnswers as Record<string, string>) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/hr/jobs/${app.job.id}/applicants`} className="text-sm text-brand-600 hover:underline">
          &larr; Back to applicants
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{app.candidate.name}</h1>
            <p className="text-sm text-slate-500">{app.candidate.email}</p>
            <p className="text-sm text-slate-500">Applied for {app.job.title} · {app.createdAt.toISOString().slice(0, 10)}</p>
          </div>
          <div className="flex items-center gap-2">
            {app.referral && <Badge tone="blue">Referred</Badge>}
            <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardTitle>Stage</CardTitle>
        <div className="mt-3">
          <StageActions applicationId={app.id} jobId={app.job.id} currentStage={app.stage} />
        </div>
      </Card>

      <Card>
        <CardTitle>Application</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-32 text-slate-500">Resume</dt>
            <dd>
              <a className="text-brand-600 hover:underline" href={`/api/files/${app.resumeUrl}`} target="_blank" rel="noreferrer">
                Download
              </a>
            </dd>
          </div>
          {app.coverLetter && (
            <div className="flex gap-2">
              <dt className="w-32 text-slate-500">Cover letter</dt>
              <dd className="whitespace-pre-wrap">{app.coverLetter}</dd>
            </div>
          )}
        </dl>
        {questions.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-slate-700">Answers</h3>
            <dl className="mt-2 space-y-2 text-sm">
              {questions.map((q) => (
                <div key={q.id} className="flex gap-2">
                  <dt className="w-48 text-slate-500">{q.label}</dt>
                  <dd className="text-slate-800">{answers[q.id] ?? <span className="text-slate-400">—</span>}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Internal notes ({app.notes.length})</CardTitle>
        <div className="mt-3 space-y-3">
          {app.notes.map((note) => (
            <div key={note.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">
                {note.author.name} · {note.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{note.body}</p>
            </div>
          ))}
          {app.notes.length === 0 && (
            <p className="text-sm text-slate-500">No notes yet.</p>
          )}
        </div>
        <div className="mt-4">
          <NoteForm applicationId={app.id} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
git add "src/app/dashboard/hr/applications/"
git commit -m "feat(ats): HR application detail with stage actions and notes thread"
```

---

## Task 6: HR top-level "Applicants" page (cross-job inbox)

**Files:**
- Create: `src/app/dashboard/hr/applicants/page.tsx`

Existing sidebar already links to `/dashboard/hr/applicants`. Show all active applications grouped by job, with a quick link to each.

- [ ] **Step 1: Implement**

```tsx
import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const STAGE_LABEL: Record<AppStage, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};
const STAGE_TONE: Record<AppStage, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function HrApplicantsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const apps = await prisma.application.findMany({
    where: { stage: { notIn: ['HIRED', 'REJECTED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      candidate: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Active applicants</h1>
      <p className="text-sm text-slate-500">{apps.length} active application{apps.length === 1 ? '' : 's'} across all open jobs.</p>

      <Card>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-600">No active applications.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/hr/applications/${app.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {app.candidate.name}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {app.candidate.email} · for{' '}
                    <Link href={`/dashboard/hr/jobs/${app.job.id}/applicants`} className="hover:underline">
                      {app.job.title}
                    </Link>
                  </div>
                </div>
                <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/hr/applicants/page.tsx
git commit -m "feat(hr): cross-job applicants inbox"
```

---

## Task 7: Phase 3 sweep + final review

- [ ] **Step 1: Run sweep**

```bash
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm test
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npx tsc --noEmit
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm run lint
PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm run build
```

- [ ] **Step 2: Dispatch final opus code review** covering: `atsService` transition rules, `moveStage` race safety, notes service, action role enforcement, file-serving route (resume download is gated by the existing /api/files auth-only check — flag if per-application ownership is wanted now), template registrations.

- [ ] **Step 3: Apply any blockers, then tag + merge**

```bash
git tag phase-3-complete
git checkout main
git merge --ff-only phase-3-ats-pipeline
git branch -d phase-3-ats-pipeline
```

---

## End-of-plan state

- 6 commits implementing the ATS
- HR can: see kanban of applicants per job, see cross-job inbox of active applicants, open any application's profile, advance/reject via valid-transition rules, post internal notes
- Candidate gets an email on every stage change; OFFER uses a dedicated copy
- AuditLog records every stage move + every note
- ~160 tests total

## Out of scope (deferred)
- Drag-and-drop kanban (a v2 UX enhancement; "Move to" buttons cover MVP)
- Bulk stage moves
- Referral linkage on candidate profile (Phase 4 wires it; profile already shows the badge if Referral exists)
- Per-application file-serving ownership tightening (current rule: any authed user can fetch any file by path; tighten when there's a real exfiltration vector)
