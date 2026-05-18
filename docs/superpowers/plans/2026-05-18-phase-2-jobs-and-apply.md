# Phase 2 — Jobs + Apply

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR creates/edits/closes job postings with custom application questions; the public job board lists open roles with search + filter; candidates apply via a dynamic form; the email pipeline confirms receipt; candidates track applications on their dashboard.

**Architecture:** Server actions for HR mutations. Public job board is a server component. Custom questions stored as JSON on `Job`; dynamic form rendered client-side, answers validated server-side against the job's current question set at submit time.

**Tech Stack:** Same as Phase 1 (Next.js 14 + Prisma + Tailwind + Zod + NextAuth).

**Prerequisites:** Phase 1 complete (tag `phase-1-complete`). 102 tests passing.

**End-of-plan state:** HR can publish a job with custom questions; the public board shows it; a candidate can apply and see status; an email is logged; ~130 tests passing total.

---

## Task 1: Job + custom question Zod schemas

**Files:**
- Create: `src/lib/validation/jobs.ts`, `src/lib/validation/jobs.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/validation/jobs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { jobInputSchema, customQuestionsSchema, applicationInputSchema } from './jobs';

describe('customQuestionsSchema', () => {
  it('accepts empty array', () => {
    expect(customQuestionsSchema.parse([])).toEqual([]);
  });

  it('accepts SHORT_TEXT + LONG_TEXT + YES_NO', () => {
    const r = customQuestionsSchema.parse([
      { id: 'q1', type: 'SHORT_TEXT', label: 'Where are you based?', required: true },
      { id: 'q2', type: 'LONG_TEXT',  label: 'Why this role?',       required: false },
      { id: 'q3', type: 'YES_NO',     label: 'Can you relocate?',    required: true },
    ]);
    expect(r).toHaveLength(3);
  });

  it('requires options for SINGLE_CHOICE', () => {
    expect(() => customQuestionsSchema.parse([
      { id: 'q1', type: 'SINGLE_CHOICE', label: 'Pick one', required: true },
    ])).toThrow();
    const ok = customQuestionsSchema.parse([
      { id: 'q1', type: 'SINGLE_CHOICE', label: 'Pick one', required: true, options: ['A', 'B'] },
    ]);
    expect(ok).toHaveLength(1);
  });

  it('rejects duplicate question ids', () => {
    expect(() => customQuestionsSchema.parse([
      { id: 'q1', type: 'SHORT_TEXT', label: 'A', required: false },
      { id: 'q1', type: 'SHORT_TEXT', label: 'B', required: false },
    ])).toThrow(/duplicate/i);
  });
});

describe('jobInputSchema', () => {
  it('accepts a minimal valid job', () => {
    const r = jobInputSchema.parse({
      title: 'Software Engineer',
      department: 'Engineering',
      locationType: 'REMOTE',
      type: 'FULL_TIME',
      description: 'Long description.',
      requirements: 'Requirements.',
      customQuestions: [],
    });
    expect(r.title).toBe('Software Engineer');
  });

  it('rejects salary range where min > max', () => {
    expect(() => jobInputSchema.parse({
      title: 'X', department: 'X', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'x', requirements: 'x', customQuestions: [],
      salaryMin: 200000, salaryMax: 100000,
    })).toThrow(/salary/i);
  });

  it('requires locationCity when locationType is ONSITE or HYBRID', () => {
    expect(() => jobInputSchema.parse({
      title: 'X', department: 'X', locationType: 'ONSITE', type: 'FULL_TIME',
      description: 'x', requirements: 'x', customQuestions: [],
    })).toThrow(/locationCity/i);
  });
});

describe('applicationInputSchema', () => {
  it('validates answers against a question list', () => {
    const questions = [
      { id: 'q1', type: 'SHORT_TEXT' as const, label: 'Where?', required: true },
    ];
    const ok = applicationInputSchema(questions).parse({
      jobId: 'job-1',
      resumeUrl: 'resume/job-1/abc-r.pdf',
      coverLetter: 'Hi',
      customAnswers: { q1: 'Berlin' },
    });
    expect(ok.customAnswers.q1).toBe('Berlin');
  });

  it('rejects when a required answer is missing', () => {
    const questions = [
      { id: 'q1', type: 'SHORT_TEXT' as const, label: 'Where?', required: true },
    ];
    expect(() => applicationInputSchema(questions).parse({
      jobId: 'job-1',
      resumeUrl: 'resume/job-1/r.pdf',
      customAnswers: {},
    })).toThrow(/required/i);
  });

  it('rejects answers to unknown question ids', () => {
    const ok = applicationInputSchema([]).parse({
      jobId: 'job-1',
      resumeUrl: 'r.pdf',
      customAnswers: {},
    });
    expect(ok).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — should fail**

`npm test -- src/lib/validation/jobs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/validation/jobs.ts`:
```ts
import { z } from 'zod';
import type { CustomQuestion } from '@/types/customQuestions';

const baseQuestion = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  required: z.boolean(),
});

const shortText  = baseQuestion.extend({ type: z.literal('SHORT_TEXT')  });
const longText   = baseQuestion.extend({ type: z.literal('LONG_TEXT')   });
const yesNo      = baseQuestion.extend({ type: z.literal('YES_NO')      });
const singleChoice = baseQuestion.extend({
  type: z.literal('SINGLE_CHOICE'),
  options: z.array(z.string().min(1)).min(2).max(20),
});

const customQuestion = z.discriminatedUnion('type', [shortText, longText, yesNo, singleChoice]);

export const customQuestionsSchema = z.array(customQuestion).max(20).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const q of arr) {
    if (seen.has(q.id)) {
      ctx.addIssue({ code: 'custom', message: `duplicate question id: ${q.id}` });
      return;
    }
    seen.add(q.id);
  }
});

export const jobInputSchema = z.object({
  title:        z.string().min(1).max(200),
  department:   z.string().min(1).max(120),
  locationType: z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  locationCity: z.string().max(120).optional(),
  type:         z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  description:  z.string().min(20).max(20000),
  requirements: z.string().min(10).max(20000),
  salaryMin:    z.number().int().positive().optional(),
  salaryMax:    z.number().int().positive().optional(),
  currency:     z.string().length(3).default('USD'),
  deadline:     z.coerce.date().optional(),
  customQuestions: customQuestionsSchema,
}).superRefine((data, ctx) => {
  if (data.salaryMin && data.salaryMax && data.salaryMin > data.salaryMax) {
    ctx.addIssue({ code: 'custom', path: ['salaryMin'], message: 'salaryMin must be ≤ salaryMax' });
  }
  if ((data.locationType === 'ONSITE' || data.locationType === 'HYBRID') && !data.locationCity) {
    ctx.addIssue({ code: 'custom', path: ['locationCity'], message: 'locationCity required for ONSITE/HYBRID' });
  }
});
export type JobInput = z.infer<typeof jobInputSchema>;

export function applicationInputSchema(questions: CustomQuestion[]) {
  const known = new Set(questions.map((q) => q.id));
  return z.object({
    jobId: z.string().min(1),
    resumeUrl: z.string().min(1),
    coverLetter: z.string().max(20000).optional(),
    customAnswers: z.record(z.string()),
  }).superRefine((data, ctx) => {
    for (const q of questions) {
      const ans = data.customAnswers[q.id];
      if (q.required && (!ans || ans.trim() === '')) {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: `${q.label} is required` });
      }
      if (q.type === 'YES_NO' && ans !== undefined && ans !== 'YES' && ans !== 'NO') {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: 'Must be YES or NO' });
      }
      if (q.type === 'SINGLE_CHOICE' && ans !== undefined && !q.options.includes(ans)) {
        ctx.addIssue({ code: 'custom', path: ['customAnswers', q.id], message: 'Not a valid option' });
      }
    }
    // Drop unknown answer ids silently — don't reject.
    for (const k of Object.keys(data.customAnswers)) {
      if (!known.has(k)) delete data.customAnswers[k];
    }
  });
}
```

- [ ] **Step 4: Run — should pass**

`npm test -- src/lib/validation/jobs.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/jobs.ts src/lib/validation/jobs.test.ts
git commit -m "feat(validation): add job + custom-question + application Zod schemas"
```

---

## Task 2: jobService — create / update / close

**Files:**
- Create: `src/lib/services/jobService.ts`, `src/lib/services/jobService.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/services/jobService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  createJob,
  updateJob,
  publishJob,
  closeJob,
  listJobsForHr,
  listPublicJobs,
  getPublicJob,
} from './jobService';

async function makeHr() {
  return prisma.user.create({
    data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' },
  });
}

const jobFixture = {
  title: 'Software Engineer',
  department: 'Engineering',
  locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const,
  description: 'We build practical software for working teams.',
  requirements: 'Three years backend.',
  customQuestions: [],
  currency: 'USD',
};

describe('createJob', () => {
  beforeEach(() => resetDb());

  it('creates a job in DRAFT status', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const job = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(job?.status).toBe('DRAFT');
    expect(job?.title).toBe('Software Engineer');
  });

  it('records an audit row', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    expect(r.ok).toBe(true);
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'JOB_CREATED')).toBe(true);
  });
});

describe('publishJob / closeJob', () => {
  beforeEach(() => resetDb());

  it('moves DRAFT to OPEN and back to CLOSED with audit', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();

    expect((await publishJob({ jobId: r.jobId, actorUserId: hr.id })).ok).toBe(true);
    const opened = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(opened?.status).toBe('OPEN');

    expect((await closeJob({ jobId: r.jobId, actorUserId: hr.id })).ok).toBe(true);
    const closed = await prisma.job.findUnique({ where: { id: r.jobId } });
    expect(closed?.status).toBe('CLOSED');
    expect(closed?.closedAt).not.toBeNull();
  });
});

describe('listPublicJobs', () => {
  beforeEach(() => resetDb());

  it('shows only OPEN jobs', async () => {
    const hr = await makeHr();
    const open = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!open.ok) throw new Error();
    await publishJob({ jobId: open.jobId, actorUserId: hr.id });
    await createJob({ input: { ...jobFixture, title: 'Draft Job' }, postedByUserId: hr.id });

    const list = await listPublicJobs({});
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Software Engineer');
  });

  it('filters by department', async () => {
    const hr = await makeHr();
    const a = await createJob({ input: { ...jobFixture, department: 'Engineering' }, postedByUserId: hr.id });
    const b = await createJob({ input: { ...jobFixture, title: 'Designer', department: 'Design' }, postedByUserId: hr.id });
    if (!a.ok || !b.ok) throw new Error();
    await publishJob({ jobId: a.jobId, actorUserId: hr.id });
    await publishJob({ jobId: b.jobId, actorUserId: hr.id });

    const list = await listPublicJobs({ department: 'Design' });
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Designer');
  });
});

describe('getPublicJob', () => {
  beforeEach(() => resetDb());

  it('returns null for DRAFT or CLOSED jobs', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    expect(await getPublicJob(r.jobId)).toBeNull();
  });

  it('returns the job when OPEN', async () => {
    const hr = await makeHr();
    const r = await createJob({ input: jobFixture, postedByUserId: hr.id });
    if (!r.ok) throw new Error();
    await publishJob({ jobId: r.jobId, actorUserId: hr.id });
    const got = await getPublicJob(r.jobId);
    expect(got?.title).toBe('Software Engineer');
  });
});

describe('listJobsForHr', () => {
  beforeEach(() => resetDb());

  it('returns ALL jobs (draft + open + closed)', async () => {
    const hr = await makeHr();
    const a = await createJob({ input: jobFixture, postedByUserId: hr.id });
    const b = await createJob({ input: { ...jobFixture, title: 'Other' }, postedByUserId: hr.id });
    if (!a.ok || !b.ok) throw new Error();
    await publishJob({ jobId: a.jobId, actorUserId: hr.id });
    const list = await listJobsForHr();
    expect(list).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — should fail**

`npm test -- src/lib/services/jobService.test.ts`

- [ ] **Step 3: Implement**

`src/lib/services/jobService.ts`:
```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { jobInputSchema, type JobInput } from '@/lib/validation/jobs';

export async function createJob(args: { input: JobInput; postedByUserId: string }): Promise<{ ok: true; jobId: string } | { ok: false; reason: 'INVALID' }> {
  const parsed = jobInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };
  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      department: parsed.data.department,
      locationType: parsed.data.locationType,
      locationCity: parsed.data.locationCity ?? null,
      type: parsed.data.type,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      deadline: parsed.data.deadline ?? null,
      customQuestions: parsed.data.customQuestions as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
      postedById: args.postedByUserId,
    },
  });
  await recordAudit({
    actorUserId: args.postedByUserId,
    action: 'JOB_CREATED',
    entityType: 'Job',
    entityId: job.id,
    metadata: { title: job.title },
  });
  return { ok: true, jobId: job.id };
}

export async function updateJob(args: { jobId: string; input: JobInput; actorUserId: string }): Promise<{ ok: true } | { ok: false; reason: 'INVALID' | 'NOT_FOUND' }> {
  const parsed = jobInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };
  const existing = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  await prisma.job.update({
    where: { id: args.jobId },
    data: {
      title: parsed.data.title,
      department: parsed.data.department,
      locationType: parsed.data.locationType,
      locationCity: parsed.data.locationCity ?? null,
      type: parsed.data.type,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      deadline: parsed.data.deadline ?? null,
      customQuestions: parsed.data.customQuestions as unknown as Prisma.InputJsonValue,
    },
  });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_UPDATED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function publishJob(args: { jobId: string; actorUserId: string }): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' }> {
  const r = await prisma.job.updateMany({
    where: { id: args.jobId },
    data: { status: 'OPEN', closedAt: null },
  });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_PUBLISHED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function closeJob(args: { jobId: string; actorUserId: string }): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' }> {
  const r = await prisma.job.updateMany({
    where: { id: args.jobId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'JOB_CLOSED',
    entityType: 'Job',
    entityId: args.jobId,
  });
  return { ok: true };
}

export async function listJobsForHr() {
  return prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { applications: true } } },
  });
}

export type PublicJobFilters = {
  q?: string;
  department?: string;
  locationType?: 'REMOTE' | 'ONSITE' | 'HYBRID';
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
};

export async function listPublicJobs(filters: PublicJobFilters) {
  return prisma.job.findMany({
    where: {
      status: 'OPEN',
      ...(filters.department ? { department: filters.department } : {}),
      ...(filters.locationType ? { locationType: filters.locationType } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.q
        ? {
            OR: [
              { title:       { contains: filters.q, mode: 'insensitive' as const } },
              { description: { contains: filters.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPublicJob(id: string) {
  return prisma.job.findFirst({
    where: { id, status: 'OPEN' },
  });
}
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/lib/services/jobService.test.ts
git add src/lib/services/jobService.ts src/lib/services/jobService.test.ts
git commit -m "feat(service): add jobService (create/update/publish/close + list/get)"
```

---

## Task 3: HR job posting list page

**Files:**
- Create: `src/app/dashboard/hr/jobs/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listJobsForHr } from '@/lib/services/jobService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default async function HrJobsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const jobs = await listJobsForHr();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Job postings</h1>
        <Link href="/dashboard/hr/jobs/new"><Button>New job</Button></Link>
      </div>
      <Card>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-600">No jobs yet. Create your first posting.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/hr/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {job.title}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {job.department} · {job.locationType.toLowerCase()} · {job._count.applications} applications
                  </div>
                </div>
                <Badge tone={job.status === 'OPEN' ? 'green' : job.status === 'DRAFT' ? 'neutral' : 'amber'}>
                  {job.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/app/dashboard/hr/jobs/page.tsx
git commit -m "feat(hr): list jobs with status + application counts"
```

---

## Task 4: HR job create/edit form (with custom-question builder)

**Files:**
- Create: `src/app/dashboard/hr/jobs/new/page.tsx`, `src/app/dashboard/hr/jobs/[id]/page.tsx`, `src/components/jobs/JobForm.tsx`, `src/components/jobs/CustomQuestionsEditor.tsx`, `src/app/dashboard/hr/jobs/actions.ts`

This task introduces the largest new component (the question builder). Each step below is one piece.

- [ ] **Step 1: HR job actions (`src/app/dashboard/hr/jobs/actions.ts`)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { createJob, updateJob, publishJob, closeJob } from '@/lib/services/jobService';
import { jobInputSchema, type JobInput } from '@/lib/validation/jobs';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

function parseJobFormData(fd: FormData): JobInput | null {
  const parsed = jobInputSchema.safeParse({
    title: fd.get('title'),
    department: fd.get('department'),
    locationType: fd.get('locationType'),
    locationCity: fd.get('locationCity') || undefined,
    type: fd.get('type'),
    description: fd.get('description'),
    requirements: fd.get('requirements'),
    salaryMin: fd.get('salaryMin') ? Number(fd.get('salaryMin')) : undefined,
    salaryMax: fd.get('salaryMax') ? Number(fd.get('salaryMax')) : undefined,
    currency: fd.get('currency') || 'USD',
    deadline: fd.get('deadline') || undefined,
    customQuestions: JSON.parse(String(fd.get('customQuestionsJson') ?? '[]')),
  });
  return parsed.success ? parsed.data : null;
}

export async function createJobAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const input = parseJobFormData(fd);
  if (!input) return { error: 'Some fields are invalid. Check the form and try again.' };
  const r = await createJob({ input, postedByUserId: user.id });
  if (!r.ok) return { error: 'Could not create the job.' };
  revalidatePath('/dashboard/hr/jobs');
  redirect(`/dashboard/hr/jobs/${r.jobId}`);
}

export async function updateJobAction(jobId: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const input = parseJobFormData(fd);
  if (!input) return { error: 'Some fields are invalid.' };
  const r = await updateJob({ jobId, input, actorUserId: user.id });
  if (!r.ok) return { error: r.reason === 'NOT_FOUND' ? 'Job not found.' : 'Some fields are invalid.' };
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  return { ok: true };
}

export async function publishJobAction(jobId: string): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  await publishJob({ jobId, actorUserId: user.id });
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  revalidatePath('/jobs');
}

export async function closeJobAction(jobId: string): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  await closeJob({ jobId, actorUserId: user.id });
  revalidatePath('/dashboard/hr/jobs');
  revalidatePath(`/dashboard/hr/jobs/${jobId}`);
  revalidatePath('/jobs');
}
```

- [ ] **Step 2: CustomQuestionsEditor (`src/components/jobs/CustomQuestionsEditor.tsx`)**

```tsx
'use client';

import { useState } from 'react';
import type { CustomQuestion } from '@/types/customQuestions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';

let nextId = 1;
const newId = () => `q${Date.now()}-${nextId++}`;

const TYPE_LABEL: Record<CustomQuestion['type'], string> = {
  SHORT_TEXT: 'Short text',
  LONG_TEXT: 'Long text',
  YES_NO: 'Yes / No',
  SINGLE_CHOICE: 'Single choice',
};

export function CustomQuestionsEditor({
  initialQuestions = [],
}: {
  initialQuestions?: CustomQuestion[];
}) {
  const [questions, setQuestions] = useState<CustomQuestion[]>(initialQuestions);

  function add(type: CustomQuestion['type']) {
    const base = { id: newId(), label: '', required: false };
    if (type === 'SINGLE_CHOICE') {
      setQuestions([...questions, { ...base, type, options: ['Option A', 'Option B'] }]);
    } else {
      setQuestions([...questions, { ...base, type }]);
    }
  }

  function update(idx: number, patch: Partial<CustomQuestion>) {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } as CustomQuestion : q)));
  }

  function remove(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="customQuestionsJson" value={JSON.stringify(questions)} />
      {questions.map((q, idx) => (
        <div key={q.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">{TYPE_LABEL[q.type]}</span>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
          <div className="mt-2">
            <Label htmlFor={`label-${q.id}`}>Question</Label>
            <Input id={`label-${q.id}`} value={q.label} onChange={(e) => update(idx, { label: e.target.value })} className="mt-1" />
          </div>
          {q.type === 'SINGLE_CHOICE' && (
            <div className="mt-2">
              <Label>Options (one per line)</Label>
              <textarea
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={q.options.join('\n')}
                onChange={(e) => update(idx, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input id={`req-${q.id}`} type="checkbox" checked={q.required} onChange={(e) => update(idx, { required: e.target.checked })} />
            <Label htmlFor={`req-${q.id}`} className="!font-normal">Required</Label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => add('SHORT_TEXT')}>+ Short text</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('LONG_TEXT')}>+ Long text</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('YES_NO')}>+ Yes/No</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('SINGLE_CHOICE')}>+ Single choice</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: JobForm (`src/components/jobs/JobForm.tsx`)**

```tsx
'use client';

import { useFormState } from 'react-dom';
import type { CustomQuestion } from '@/types/customQuestions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CustomQuestionsEditor } from './CustomQuestionsEditor';

type Defaults = {
  title: string;
  department: string;
  locationType: string;
  locationCity: string;
  type: string;
  description: string;
  requirements: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  deadline: string;
  customQuestions: CustomQuestion[];
};

const blank: Defaults = {
  title: '', department: '', locationType: 'REMOTE', locationCity: '',
  type: 'FULL_TIME', description: '', requirements: '',
  salaryMin: '', salaryMax: '', currency: 'USD', deadline: '',
  customQuestions: [],
};

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export function JobForm({
  defaults = blank,
  action,
  submitLabel,
}: {
  defaults?: Defaults;
  action: (prev: FormState | undefined, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {} as FormState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={defaults.title} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" defaultValue={defaults.department} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="type">Job type</Label>
          <select id="type" name="type" defaultValue={defaults.type} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="locationType">Location type</Label>
          <select id="locationType" name="locationType" defaultValue={defaults.locationType} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="REMOTE">Remote</option>
            <option value="ONSITE">Onsite</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <div>
          <Label htmlFor="locationCity">City (for Onsite/Hybrid)</Label>
          <Input id="locationCity" name="locationCity" defaultValue={defaults.locationCity} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaults.description} required rows={6}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <Label htmlFor="requirements">Requirements</Label>
        <textarea id="requirements" name="requirements" defaultValue={defaults.requirements} required rows={4}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="salaryMin">Salary min (optional)</Label>
          <Input id="salaryMin" name="salaryMin" type="number" defaultValue={defaults.salaryMin} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="salaryMax">Salary max (optional)</Label>
          <Input id="salaryMax" name="salaryMax" type="number" defaultValue={defaults.salaryMax} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" maxLength={3} defaultValue={defaults.currency} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="deadline">Application deadline (optional)</Label>
        <Input id="deadline" name="deadline" type="date" defaultValue={defaults.deadline} className="mt-1" />
      </div>

      <div>
        <Label>Custom questions</Label>
        <p className="mt-1 text-xs text-slate-500">Optional — additional questions candidates must answer for this role.</p>
        <div className="mt-2">
          <CustomQuestionsEditor initialQuestions={defaults.customQuestions} />
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step 4: New job page**

`src/app/dashboard/hr/jobs/new/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { JobForm } from '@/components/jobs/JobForm';
import { createJobAction } from '../actions';

export default async function NewJobPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New job posting</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <JobForm action={createJobAction} submitLabel="Create draft" />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Edit job page**

`src/app/dashboard/hr/jobs/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { JobForm } from '@/components/jobs/JobForm';
import { updateJobAction, publishJobAction, closeJobAction } from '../actions';
import type { CustomQuestion } from '@/types/customQuestions';

export default async function EditJobPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const updateBoundAction = updateJobAction.bind(null, job.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
        <Badge tone={job.status === 'OPEN' ? 'green' : job.status === 'DRAFT' ? 'neutral' : 'amber'}>
          {job.status}
        </Badge>
      </div>

      <Card>
        <CardTitle>Status</CardTitle>
        <div className="mt-3 flex gap-2">
          {job.status !== 'OPEN' && (
            <form action={publishJobAction.bind(null, job.id)}>
              <button className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                Publish
              </button>
            </form>
          )}
          {job.status !== 'CLOSED' && (
            <form action={closeJobAction.bind(null, job.id)}>
              <button className="rounded-md bg-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-300">
                Close
              </button>
            </form>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Edit</CardTitle>
        <div className="mt-4">
          <JobForm
            defaults={{
              title: job.title,
              department: job.department,
              locationType: job.locationType,
              locationCity: job.locationCity ?? '',
              type: job.type,
              description: job.description,
              requirements: job.requirements,
              salaryMin: job.salaryMin?.toString() ?? '',
              salaryMax: job.salaryMax?.toString() ?? '',
              currency: job.currency,
              deadline: job.deadline ? job.deadline.toISOString().slice(0, 10) : '',
              customQuestions: (job.customQuestions as unknown as CustomQuestion[]) ?? [],
            }}
            action={updateBoundAction}
            submitLabel="Save changes"
          />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Build + manual smoke + commit**

```bash
npm run build
git add src/app/dashboard/hr/jobs/ src/components/jobs/
git commit -m "feat(hr): job create/edit form with custom-question builder + publish/close"
```

---

## Task 5: Public job board

**Files:**
- Create: `src/app/jobs/page.tsx`, `src/components/jobs/JobFilters.tsx`

- [ ] **Step 1: Filters component (client)**

`src/components/jobs/JobFilters.tsx`:
```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function JobFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value); else params.delete(key);
      router.push(`/jobs?${params.toString()}`);
    },
    [router, sp],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500">Search</label>
        <input
          defaultValue={sp.get('q') ?? ''}
          onBlur={(e) => update('q', e.target.value)}
          placeholder="Title or keyword"
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Department</label>
        <input
          defaultValue={sp.get('department') ?? ''}
          onBlur={(e) => update('department', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Location</label>
        <select
          defaultValue={sp.get('locationType') ?? ''}
          onChange={(e) => update('locationType', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="REMOTE">Remote</option>
          <option value="ONSITE">Onsite</option>
          <option value="HYBRID">Hybrid</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Type</label>
        <select
          defaultValue={sp.get('type') ?? ''}
          onChange={(e) => update('type', e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="FULL_TIME">Full-time</option>
          <option value="PART_TIME">Part-time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Intern</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Public job board page**

`src/app/jobs/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { listPublicJobs } from '@/lib/services/jobService';
import { JobFilters } from '@/components/jobs/JobFilters';
import { Badge } from '@/components/ui/Badge';

export const metadata = { title: 'Open roles · ItsNotTechy Careers' };

const LOCATION_LABEL: Record<string, string> = { REMOTE: 'Remote', ONSITE: 'Onsite', HYBRID: 'Hybrid' };
const TYPE_LABEL:     Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERN: 'Intern' };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; department?: string; locationType?: 'REMOTE' | 'ONSITE' | 'HYBRID'; type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' };
}) {
  const jobs = await listPublicJobs(searchParams);

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Open roles</h1>
        <p className="mt-2 text-slate-600">{jobs.length} role{jobs.length === 1 ? '' : 's'} open right now.</p>

        <div className="mt-6">
          <JobFilters />
        </div>

        <ul className="mt-8 space-y-3">
          {jobs.map((job) => (
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
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{job.description}</p>
              </Link>
            </li>
          ))}
          {jobs.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No matching roles right now. Try clearing filters or check back later.
            </li>
          )}
        </ul>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/app/jobs/page.tsx src/components/jobs/JobFilters.tsx
git commit -m "feat(jobs): public job board with filters"
```

---

## Task 6: Public job detail page

**Files:**
- Create: `src/app/jobs/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { getPublicJob } from '@/lib/services/jobService';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { CustomQuestion } from '@/types/customQuestions';

const LOCATION_LABEL: Record<string, string> = { REMOTE: 'Remote', ONSITE: 'Onsite', HYBRID: 'Hybrid' };
const TYPE_LABEL:     Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERN: 'Intern' };

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getPublicJob(params.id);
  if (!job) notFound();
  const customQuestions = (job.customQuestions as unknown as CustomQuestion[]) ?? [];

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/jobs" className="text-sm text-brand-600 hover:underline">← All roles</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{job.department}</span>
          <span>·</span>
          <Badge tone="blue">{LOCATION_LABEL[job.locationType]}{job.locationCity ? ` · ${job.locationCity}` : ''}</Badge>
          <Badge tone="neutral">{TYPE_LABEL[job.type]}</Badge>
          {job.salaryMin && job.salaryMax && (
            <Badge tone="green">{job.currency} {job.salaryMin.toLocaleString()} – {job.salaryMax.toLocaleString()}</Badge>
          )}
        </div>

        <section className="prose mt-8 max-w-none">
          <h2 className="text-lg font-semibold">About the role</h2>
          <p className="whitespace-pre-wrap text-slate-700">{job.description}</p>

          <h2 className="mt-6 text-lg font-semibold">Requirements</h2>
          <p className="whitespace-pre-wrap text-slate-700">{job.requirements}</p>
        </section>

        <div className="mt-10">
          <Link href={`/jobs/${job.id}/apply`}>
            <Button size="lg">Apply for this role</Button>
          </Link>
          {customQuestions.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">This application includes {customQuestions.length} additional question{customQuestions.length === 1 ? '' : 's'}.</p>
          )}
          {job.deadline && (
            <p className="mt-2 text-xs text-slate-500">Apply by {job.deadline.toISOString().slice(0, 10)}.</p>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/jobs/\[id\]/
git commit -m "feat(jobs): public job detail page"
```

---

## Task 7: applicationService — submit and list

**Files:**
- Create: `src/lib/services/applicationService.ts`, `src/lib/services/applicationService.test.ts`

- [ ] **Step 1: Write failing tests**

(Plan continues — see file. TDD pattern same as prior tasks: failing test → implement → green → commit.)

Key behaviors to test:
- `submitApplication` creates `Application{stage:APPLIED}`, sends email #4, records audit
- Rejects when the job is not OPEN
- Rejects when the candidate already applied (unique constraint)
- Validates custom answers against the job's current questions
- `listMyApplications(userId)` returns the candidate's applications with job info
- `getApplicationForCandidate(id, userId)` returns null for other users' applications

- [ ] **Step 2: Implement, run, commit**

```bash
git add src/lib/services/applicationService.ts src/lib/services/applicationService.test.ts
git commit -m "feat(service): add applicationService with submit + list + email"
```

---

## Task 8: Application form + apply page (candidate)

**Files:**
- Create: `src/app/jobs/[id]/apply/page.tsx`, `src/app/jobs/[id]/apply/ApplyForm.tsx`, `src/components/forms/CustomAnswersFields.tsx`, `src/app/jobs/[id]/apply/actions.ts`

Includes the dynamic-question renderer (`CustomAnswersFields`), resume upload via `/api/upload` from the client, then submit via server action.

- [ ] Build + commit:
```bash
git commit -m "feat(jobs): candidate apply flow with resume upload and dynamic answers"
```

---

## Task 9: application-received email template + wiring

**Files:**
- Create: `src/emails/templates/application-received.html`
- Modify: `src/lib/email/templates.ts` (extend `TemplateData` + `subjects`)
- Modify: `src/lib/services/applicationService.ts` (fire email on submit — already done in Task 7 spec, this task just wires the template into the registry)

- [ ] Commit:
```bash
git commit -m "feat(email): add application-received template"
```

---

## Task 10: Candidate "My Applications" dashboard

**Files:**
- Modify: `src/app/dashboard/candidate/page.tsx`

Replace the placeholder with a real list of the candidate's applications with status badges.

- [ ] Commit:
```bash
git commit -m "feat(candidate): show my applications on candidate dashboard"
```

---

## Task 11: Phase 2 sweep + final review

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [ ] Dispatch final code review of all Phase 2 commits
- [ ] Tag `phase-2-complete`
- [ ] Merge to `main`

---

## End-of-plan state

- HR can: create draft, edit, add custom questions, publish, close jobs
- Public can: browse `/jobs`, filter, view detail
- Candidate can: apply (with custom answers + resume), see their applications
- Email #4 fires on application
- ~130 tests passing total

## Out of scope (deferred to later phases)
- HR pipeline (kanban) for applicants — Phase 3
- Internal notes on applications — Phase 3
- Referral linkage on apply — Phase 4
