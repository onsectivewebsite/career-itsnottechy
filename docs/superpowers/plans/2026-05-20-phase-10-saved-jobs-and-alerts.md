# Phase 10 — Saved Jobs & Job Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let candidates save jobs and see them on their dashboard, and let candidates opt in to an email whenever a new role is published.

**Architecture:** A `SavedJob` join table and a `savedJobService`; a `jobAlertsEnabled` boolean on `CandidateProfile` and a `jobAlertService`; `publishJob` emails opted-in candidates on the first DRAFT→OPEN transition. Two new client components (`SaveJobButton`, `JobAlertsToggle`) and two server actions. One migration.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Zod, Vitest.

**Conventions for every task:**
- Node/npm/npx come from nvm — prefix EVERY `npm`/`npx` command with `PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.
- `npm test` runs the full Vitest suite; `npx vitest run <path>` runs one file.
- DB tests target the `careers_test` database and call `resetDb()` in `beforeEach`.
- Commit after every task with the message in its final step.
- Spec: `docs/superpowers/specs/2026-05-20-phase-10-saved-jobs-and-alerts-design.md`.

---

## Task 1: Prisma schema — SavedJob model and alert flag

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/test/db.ts`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`:

1. Add to the `User` model relation block (alongside `applications`, `savedJobs` etc.):
```prisma
  savedJobs              SavedJob[]           @relation("CandidateSavedJobs")
```

2. Add to the `Job` model relation block (alongside `applications`, `referrals`):
```prisma
  savedBy      SavedJob[]
```

3. Add to the `CandidateProfile` model, as a new field:
```prisma
  jobAlertsEnabled Boolean @default(false)
```

4. Add the new model after the `CandidateProfile` model:
```prisma
model SavedJob {
  id              String   @id @default(cuid())
  candidateUserId String
  candidate       User     @relation("CandidateSavedJobs", fields: [candidateUserId], references: [id], onDelete: Cascade)
  jobId           String
  job             Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@unique([candidateUserId, jobId])
  @@index([candidateUserId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_saved_jobs_and_alerts`
Expected: a new migration folder is created and applied; `prisma generate` runs. No errors.

- [ ] **Step 3: Add SavedJob to the test-DB reset helper**

In `src/lib/test/db.ts`, add `'SavedJob',` to the `tables` array on the line immediately **before** `'Job',`:
```ts
    'SavedJob',
    'Job',
```

- [ ] **Step 4: Apply the migration to the test database**

Run: `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`
Expected: "All migrations have been successfully applied." (If `$TEST_DATABASE_URL` is not set, read it from `.env` and pass it inline.)

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/test/db.ts
git commit -m "feat(saved-jobs): add SavedJob model and CandidateProfile.jobAlertsEnabled"
```

---

## Task 2: `savedJobService`

**Files:**
- Create: `src/lib/services/savedJobService.ts`
- Test: `src/lib/services/savedJobService.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/services/savedJobService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { toggleSavedJob, listSavedJobs, getSavedJobIds } from './savedJobService';

async function fixtures() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE' } });
  const job = await prisma.job.create({
    data: {
      title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'A description long enough to be valid.', requirements: 'Reqs.',
      status: 'OPEN', postedById: hr.id,
    },
  });
  return { cand, job };
}

describe('toggleSavedJob', () => {
  beforeEach(() => resetDb());

  it('saves then unsaves a job', async () => {
    const { cand, job } = await fixtures();
    const first = await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    expect(first).toEqual({ ok: true, saved: true });
    const second = await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    expect(second).toEqual({ ok: true, saved: false });
    expect(await prisma.savedJob.count()).toBe(0);
  });

  it('returns JOB_NOT_FOUND for an unknown job', async () => {
    const { cand } = await fixtures();
    const r = await toggleSavedJob({ candidateUserId: cand.id, jobId: 'nope' });
    expect(r).toEqual({ ok: false, reason: 'JOB_NOT_FOUND' });
  });
});

describe('listSavedJobs / getSavedJobIds', () => {
  beforeEach(() => resetDb());

  it('lists saved jobs with job data and returns the id set', async () => {
    const { cand, job } = await fixtures();
    await toggleSavedJob({ candidateUserId: cand.id, jobId: job.id });
    const list = await listSavedJobs(cand.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.job.title).toBe('Designer');
    const ids = await getSavedJobIds(cand.id);
    expect(ids.has(job.id)).toBe(true);
    expect(ids.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/savedJobService.test.ts`
Expected: FAIL — `./savedJobService` does not exist.

- [ ] **Step 3: Implement the service**

`src/lib/services/savedJobService.ts`:
```ts
import { prisma } from '@/lib/prisma';

export type ToggleSavedResult =
  | { ok: true; saved: boolean }
  | { ok: false; reason: 'JOB_NOT_FOUND' };

/** Save the job if not saved, unsave it if it is. Returns the resulting saved state. */
export async function toggleSavedJob(args: {
  candidateUserId: string;
  jobId: string;
}): Promise<ToggleSavedResult> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId }, select: { id: true } });
  if (!job) return { ok: false, reason: 'JOB_NOT_FOUND' };

  const existing = await prisma.savedJob.findUnique({
    where: { candidateUserId_jobId: { candidateUserId: args.candidateUserId, jobId: args.jobId } },
  });
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    return { ok: true, saved: false };
  }
  await prisma.savedJob.create({
    data: { candidateUserId: args.candidateUserId, jobId: args.jobId },
  });
  return { ok: true, saved: true };
}

/** The candidate's saved jobs with job summary data, newest-saved first. */
export async function listSavedJobs(candidateUserId: string) {
  return prisma.savedJob.findMany({
    where: { candidateUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        select: {
          id: true, title: true, department: true,
          locationType: true, locationCity: true, type: true, status: true,
        },
      },
    },
  });
}

/** The set of job ids this candidate has saved — for rendering save state across a list. */
export async function getSavedJobIds(candidateUserId: string): Promise<Set<string>> {
  const rows = await prisma.savedJob.findMany({
    where: { candidateUserId },
    select: { jobId: true },
  });
  return new Set(rows.map((r) => r.jobId));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/savedJobService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/savedJobService.ts src/lib/services/savedJobService.test.ts
git commit -m "feat(saved-jobs): add savedJobService"
```

---

## Task 3: SaveJobButton, action, and job detail page

**Files:**
- Create: `src/app/jobs/savedJobActions.ts`
- Create: `src/components/jobs/SaveJobButton.tsx`
- Modify: `src/app/jobs/[id]/page.tsx`

- [ ] **Step 1: Create the server action**

`src/app/jobs/savedJobActions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { toggleSavedJob } from '@/lib/services/savedJobService';

/** Toggles a job's saved state for the current candidate. Returns the new state. */
export async function toggleSavedJobAction(jobId: string): Promise<{ ok: boolean; saved: boolean }> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');
  const r = await toggleSavedJob({ candidateUserId: user.id, jobId });
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/dashboard/candidate');
  return r.ok ? { ok: true, saved: r.saved } : { ok: false, saved: false };
}
```

- [ ] **Step 2: Create the SaveJobButton component**

`src/components/jobs/SaveJobButton.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { toggleSavedJobAction } from '@/app/jobs/savedJobActions';

export function SaveJobButton({ jobId, initialSaved }: { jobId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await toggleSavedJobAction(jobId);
      if (r.ok) setSaved(r.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        saved
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {saved ? '★ Saved' : '☆ Save'}
    </button>
  );
}
```

- [ ] **Step 3: Show the button on the job detail page**

In `src/app/jobs/[id]/page.tsx`:

1. Add to the imports:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { getSavedJobIds } from '@/lib/services/savedJobService';
import { SaveJobButton } from '@/components/jobs/SaveJobButton';
```

2. After the `const job = await getPublicJob(params.id);` / `if (!job) notFound();` lines, add:
```tsx
  const viewer = await getSessionUser();
  const savedJobIds = viewer?.role === 'CANDIDATE' ? await getSavedJobIds(viewer.id) : null;
```

3. Immediately after the metadata badges `<div>` (the `<div className="mt-2 flex flex-wrap items-center gap-2 ...">` containing the Badge components) and before the `<section className="prose ...">`, insert:
```tsx
        {savedJobIds && (
          <div className="mt-4">
            <SaveJobButton jobId={job.id} initialSaved={savedJobIds.has(job.id)} />
          </div>
        )}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/jobs/savedJobActions.ts src/components/jobs/SaveJobButton.tsx src/app/jobs/[id]/page.tsx
git commit -m "feat(saved-jobs): save button on the job detail page"
```

---

## Task 4: SaveJobButton on the jobs list

**Files:**
- Modify: `src/app/jobs/page.tsx`

- [ ] **Step 1: Fetch saved state and render the button per card**

In `src/app/jobs/page.tsx`:

1. Add to the imports:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { getSavedJobIds } from '@/lib/services/savedJobService';
import { SaveJobButton } from '@/components/jobs/SaveJobButton';
```

2. After the `const jobs = await listPublicJobs(filters);` line, add:
```tsx
  const viewer = await getSessionUser();
  const savedJobIds = viewer?.role === 'CANDIDATE' ? await getSavedJobIds(viewer.id) : null;
```

3. Replace the entire `<li>` block inside `jobs.map(...)`:
```tsx
            <li key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-300">
              <Link href={`/jobs/${job.id}`} className="block">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">{job.title}</h2>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{TYPE_LABEL[job.type]}</Badge>
                    <Badge tone="blue">{LOCATION_LABEL[job.locationType]}{job.locationCity ? ` · ${job.locationCity}` : ''}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{job.department}</div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{htmlToText(job.description)}</p>
              </Link>
            </li>
```
with:
```tsx
            <li key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-300">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/jobs/${job.id}`} className="block flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{job.title}</h2>
                    <Badge tone="neutral">{TYPE_LABEL[job.type]}</Badge>
                    <Badge tone="blue">{LOCATION_LABEL[job.locationType]}{job.locationCity ? ` · ${job.locationCity}` : ''}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{job.department}</div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-700">{htmlToText(job.description)}</p>
                </Link>
                {savedJobIds && (
                  <SaveJobButton jobId={job.id} initialSaved={savedJobIds.has(job.id)} />
                )}
              </div>
            </li>
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/jobs/page.tsx
git commit -m "feat(saved-jobs): save button on each jobs-list card"
```

---

## Task 5: "Saved jobs" card on the candidate dashboard

**Files:**
- Modify: `src/app/dashboard/candidate/page.tsx`

- [ ] **Step 1: Add the saved-jobs card**

In `src/app/dashboard/candidate/page.tsx`:

1. Add to the imports:
```tsx
import { listSavedJobs } from '@/lib/services/savedJobService';
```

2. After the `const pendingDocuments = await listPendingDocumentsForCandidate(user.id);` line, add:
```tsx
  const savedJobs = await listSavedJobs(user.id);
```

3. Immediately after the `<Card>` block that renders "My applications" (i.e. after its closing `</Card>`) and before `<MyInterviewsWidget ... />`, insert:
```tsx
      <Card>
        <CardTitle>Saved jobs</CardTitle>
        {savedJobs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t saved any roles yet.{' '}
            <Link href="/jobs" className="font-medium text-brand-600 hover:underline">
              Browse open roles
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {savedJobs.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/jobs/${s.job.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {s.job.title}
                  </Link>
                  <div className="text-sm text-slate-500">{s.job.department}</div>
                </div>
                <Badge tone={s.job.status === 'OPEN' ? 'green' : 'neutral'}>
                  {s.job.status === 'OPEN' ? 'Open' : 'Closed'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
```
`Card`, `CardTitle`, `Badge`, and `Link` are already imported on this page.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/candidate/page.tsx
git commit -m "feat(saved-jobs): show saved jobs on the candidate dashboard"
```

---

## Task 6: `job-alert` email template

**Files:**
- Create: `src/emails/templates/job-alert.html`
- Modify: `src/lib/email/templates.ts`

- [ ] **Step 1: Create the HTML template**

`src/emails/templates/job-alert.html`:
```html
<p>Hi {{name}},</p>
<p>A new role has just opened at It's Not Techy:</p>
<p><strong>{{jobTitle}}</strong></p>
<p>Take a look and apply if it's a fit:</p>
<p><a class="btn" href="{{jobUrl}}">View the role</a></p>
<p>You're receiving this because you turned on job alerts. You can turn them off anytime from your dashboard.</p>
```

- [ ] **Step 2: Register the template**

In `src/lib/email/templates.ts`:

1. Add an entry to the `TemplateData` type (inside the `type TemplateData = { ... }` block, e.g. after `'application-received'`):
```ts
  'job-alert': { name: string; jobTitle: string; jobUrl: string };
```

2. Add a subject line to the `subjects` object:
```ts
  'job-alert': (data) => `New role at It's Not Techy: ${data.jobTitle}`,
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/emails/templates/job-alert.html src/lib/email/templates.ts
git commit -m "feat(job-alerts): add job-alert email template"
```

---

## Task 7: `jobAlertService`

**Files:**
- Create: `src/lib/services/jobAlertService.ts`
- Test: `src/lib/services/jobAlertService.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/services/jobAlertService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { setJobAlerts, notifyNewJob } from './jobAlertService';

async function makeCandidate(email: string, alertsOn: boolean) {
  return prisma.user.create({
    data: {
      email, name: 'Cand', role: 'CANDIDATE',
      candidateProfile: { create: { jobAlertsEnabled: alertsOn } },
    },
  });
}

describe('setJobAlerts', () => {
  beforeEach(() => resetDb());

  it('turns the flag on and off', async () => {
    const cand = await makeCandidate('c@x.com', false);
    await setJobAlerts({ candidateUserId: cand.id, enabled: true });
    let profile = await prisma.candidateProfile.findUnique({ where: { userId: cand.id } });
    expect(profile?.jobAlertsEnabled).toBe(true);
    await setJobAlerts({ candidateUserId: cand.id, enabled: false });
    profile = await prisma.candidateProfile.findUnique({ where: { userId: cand.id } });
    expect(profile?.jobAlertsEnabled).toBe(false);
  });
});

describe('notifyNewJob', () => {
  beforeEach(() => resetDb());

  it('notifies only candidates with alerts enabled', async () => {
    await makeCandidate('on@x.com', true);
    await makeCandidate('off@x.com', false);
    const count = await notifyNewJob({ id: 'job1', title: 'Senior Designer' });
    expect(count).toBe(1);
  });

  it('returns 0 when nobody is subscribed', async () => {
    await makeCandidate('off@x.com', false);
    expect(await notifyNewJob({ id: 'job1', title: 'Role' })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/jobAlertService.test.ts`
Expected: FAIL — `./jobAlertService` does not exist.

- [ ] **Step 3: Implement the service**

`src/lib/services/jobAlertService.ts`:
```ts
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

/** Turn the current candidate's job alerts on or off. Upsert keyed on userId as a safety net. */
export async function setJobAlerts(args: {
  candidateUserId: string;
  enabled: boolean;
}): Promise<void> {
  await prisma.candidateProfile.upsert({
    where: { userId: args.candidateUserId },
    update: { jobAlertsEnabled: args.enabled },
    create: { userId: args.candidateUserId, jobAlertsEnabled: args.enabled },
  });
}

/** Email every alerts-enabled candidate about a newly published job. Returns the count notified. */
export async function notifyNewJob(job: { id: string; title: string }): Promise<number> {
  const subscribers = await prisma.candidateProfile.findMany({
    where: { jobAlertsEnabled: true },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const sub of subscribers) {
    await sendEmail({
      to: sub.user.email,
      template: 'job-alert',
      data: {
        name: sub.user.name,
        jobTitle: job.title,
        jobUrl: `${process.env.APP_URL ?? ''}/jobs/${job.id}`,
      },
    });
  }
  return subscribers.length;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/jobAlertService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/jobAlertService.ts src/lib/services/jobAlertService.test.ts
git commit -m "feat(job-alerts): add jobAlertService"
```

---

## Task 8: Fire alerts when a job is published

**Files:**
- Modify: `src/lib/services/jobService.ts`
- Modify: `src/lib/services/jobService.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `src/lib/services/jobService.test.ts`:
```ts
describe('publishJob job alerts', () => {
  beforeEach(() => resetDb());

  it('emails alerts-enabled candidates on first publish, not on re-open', async () => {
    const hr = await makeHr();
    await prisma.user.create({
      data: { email: 'sub@x.com', name: 'Sub', role: 'CANDIDATE',
        candidateProfile: { create: { jobAlertsEnabled: true } } },
    });
    const created = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!created.ok) throw new Error();

    await publishJob({ jobId: created.jobId, actorUserId: hr.id });
    const afterPublish = await prisma.emailLog.count({ where: { template: 'job-alert' } });
    expect(afterPublish).toBe(1);

    await closeJob({ jobId: created.jobId, actorUserId: hr.id });
    await publishJob({ jobId: created.jobId, actorUserId: hr.id });
    const afterReopen = await prisma.emailLog.count({ where: { template: 'job-alert' } });
    expect(afterReopen).toBe(1); // re-opening a CLOSED job does not re-notify
  });
});
```
This test reuses the file's existing `makeHr` helper and `jobFixture` constant. `prisma`, `resetDb`, `createJob`, `publishJob`, `closeJob` are already imported in this file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/services/jobService.test.ts`
Expected: FAIL — no `job-alert` emails are sent yet, so `afterPublish` is `0`.

- [ ] **Step 3: Update `publishJob`**

In `src/lib/services/jobService.ts`:

1. Add to the imports:
```ts
import { notifyNewJob } from './jobAlertService';
```

2. Replace the entire `publishJob` function:
```ts
export async function publishJob(args: {
  jobId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' }> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!job) return { ok: false, reason: 'NOT_FOUND' };

  const wasDraft = job.status === 'DRAFT';
  await prisma.job.update({
    where: { id: args.jobId },
    data: { status: 'OPEN', closedAt: null },
  });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_PUBLISHED',
    entityType: 'Job',
    entityId: args.jobId,
  });

  // Alerts fire once, on the first publish — never when re-opening a closed role.
  if (wasDraft) {
    await notifyNewJob({ id: job.id, title: job.title });
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/services/jobService.test.ts`
Expected: PASS — all `jobService` tests, including the existing publish/close ones, are green.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/jobService.ts src/lib/services/jobService.test.ts
git commit -m "feat(job-alerts): notify subscribers when a job is first published"
```

---

## Task 9: Job-alerts toggle on the candidate dashboard

**Files:**
- Create: `src/app/dashboard/candidate/jobAlertActions.ts`
- Create: `src/app/dashboard/candidate/JobAlertsToggle.tsx`
- Modify: `src/app/dashboard/candidate/page.tsx`

- [ ] **Step 1: Create the server action**

`src/app/dashboard/candidate/jobAlertActions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { setJobAlerts } from '@/lib/services/jobAlertService';

/** Turns the current candidate's job alerts on or off. */
export async function setJobAlertsAction(enabled: boolean): Promise<{ ok: boolean }> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');
  await setJobAlerts({ candidateUserId: user.id, enabled });
  revalidatePath('/dashboard/candidate');
  return { ok: true };
}
```

- [ ] **Step 2: Create the toggle component**

`src/app/dashboard/candidate/JobAlertsToggle.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { setJobAlertsAction } from './jobAlertActions';

export function JobAlertsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      const r = await setJobAlertsAction(next);
      if (r.ok) setEnabled(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {enabled ? 'Alerts on' : 'Alerts off'}
    </button>
  );
}
```

- [ ] **Step 3: Add the alerts card to the dashboard**

In `src/app/dashboard/candidate/page.tsx`:

1. Add to the imports:
```tsx
import { prisma } from '@/lib/prisma';
import { JobAlertsToggle } from './JobAlertsToggle';
```

2. After the `const savedJobs = await listSavedJobs(user.id);` line (added in Task 5), add:
```tsx
  const candidateProfile = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { jobAlertsEnabled: true },
  });
  const jobAlertsEnabled = candidateProfile?.jobAlertsEnabled ?? false;
```

3. Immediately after the "Saved jobs" `<Card>` block (added in Task 5) and before `<MyInterviewsWidget ... />`, insert:
```tsx
      <Card>
        <CardTitle>Job alerts</CardTitle>
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Get an email whenever a new role is posted.
          </p>
          <JobAlertsToggle initialEnabled={jobAlertsEnabled} />
        </div>
      </Card>
```

- [ ] **Step 4: Verify the build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/candidate/jobAlertActions.ts src/app/dashboard/candidate/JobAlertsToggle.tsx src/app/dashboard/candidate/page.tsx
git commit -m "feat(job-alerts): candidate dashboard alerts toggle"
```

---

# Final verification

After Task 9:

- [ ] `npm test` — all green
- [ ] `npm run build` — succeeds
- [ ] Manual smoke test: as a candidate, save a job from the jobs list and the detail page; confirm it appears under "Saved jobs" on the dashboard and unsaves correctly; turn on job alerts; as HR, publish a draft job; confirm the candidate receives a `job-alert` email (or an `EmailLog` row in test mode).

Then deploy per the runbook: rsync, `npm ci`, `npx prisma migrate deploy` (applies `add_saved_jobs_and_alerts` to production), `npm run build`, `pm2 restart`.
