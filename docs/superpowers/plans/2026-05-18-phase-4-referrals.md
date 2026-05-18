# Phase 4 — Referrals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employees and Managers can refer external candidates for open jobs. Submission auto-emails the referrer (confirmation) and the HR group (notification). When a referred candidate self-registers with the same email and applies, the application is auto-linked to the referral and HR sees "Referred by X" on the candidate profile. HR has a cross-referral inbox showing every referral, status, and (if converted) which application. Referrers see status updates when "their" candidate's application advances stages.

**Architecture:** New `referralService` owns submission + auto-link + status sync. The auto-link runs at the moment a candidate registers (via `userService.registerCandidate`) — we look up any pending referral matching the new candidate's email and pre-link them. When that candidate then applies, `submitApplication` links the referral to the new application and bumps the referral status to `CONVERTED`. Stage moves in `atsService` notify the referrer separately from the candidate.

**Tech Stack:** Same as prior phases.

**Prerequisites:** Phase 3 complete (tag `phase-3-complete`). 156 tests passing.

**End-of-plan state:** Full referral lifecycle (submit → notify → auto-link → status updates) shipping. Two new email templates (`referral-submitted`, `referral-status-update`). HR and employee dashboards extended. ~185 tests total.

---

## Task 1: Referral validation + types

**Files:**
- Create: `src/lib/validation/referrals.ts`, `src/lib/validation/referrals.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/validation/referrals.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { referralInputSchema } from './referrals';

describe('referralInputSchema', () => {
  it('accepts a minimal valid referral', () => {
    const r = referralInputSchema.parse({
      jobId: 'job-1',
      candidateName: 'Jordan Reed',
      candidateEmail: 'Jordan@example.com',
      relationship: 'Former colleague',
    });
    expect(r.candidateEmail).toBe('jordan@example.com'); // lowercased
    expect(r.candidateName).toBe('Jordan Reed');
  });

  it('rejects invalid email', () => {
    expect(() => referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'not-an-email', relationship: 'x',
    })).toThrow();
  });

  it('rejects empty relationship', () => {
    expect(() => referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'a@x.com', relationship: '',
    })).toThrow();
  });

  it('accepts optional resume URL', () => {
    const r = referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'a@x.com', relationship: 'x',
      resumeUrl: 'supporting-doc/x.pdf',
    });
    expect(r.resumeUrl).toBe('supporting-doc/x.pdf');
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/validation/referrals.ts`:
```ts
import { z } from 'zod';
import { emailSchema, nameSchema } from './common';

export const referralInputSchema = z.object({
  jobId: z.string().min(1),
  candidateName: nameSchema,
  candidateEmail: emailSchema,
  relationship: z.string().trim().min(1, 'How do you know this candidate?').max(200),
  resumeUrl: z.string().min(1).optional(),
});
export type ReferralInput = z.infer<typeof referralInputSchema>;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/referrals.ts src/lib/validation/referrals.test.ts
git commit -m "feat(validation): add referral input schema"
```

---

## Task 2: referralService — submit + list + autoLink hook + status sync

**Files:**
- Create: `src/lib/services/referralService.ts`, `src/lib/services/referralService.test.ts`
- Create: `src/emails/templates/referral-submitted.html`, `src/emails/templates/referral-status-update.html`
- Modify: `src/lib/email/templates.ts` (add 2 new template entries)

- [ ] **Step 1: Add two new templates first**

`src/emails/templates/referral-submitted.html`:
```html
<p>Hi {{referrerName}},</p>
<p>Thanks for referring <strong>{{candidateName}}</strong> for the <strong>{{jobTitle}}</strong> role.</p>
<p>We&apos;ve emailed your candidate to encourage them to apply. You can track this referral from your dashboard:</p>
<p><a class="btn" href="{{dashboardUrl}}">My referrals</a></p>
```

`src/emails/templates/referral-status-update.html`:
```html
<p>Hi {{referrerName}},</p>
<p>An update on your referral <strong>{{candidateName}}</strong> for <strong>{{jobTitle}}</strong>:</p>
<p>Their application has moved to <strong>{{stageLabel}}</strong>.</p>
<p><a class="btn" href="{{dashboardUrl}}">My referrals</a></p>
```

Extend `src/lib/email/templates.ts`. In `TemplateData`:
```ts
  'referral-submitted':     { referrerName: string; candidateName: string; jobTitle: string; dashboardUrl: string };
  'referral-status-update': { referrerName: string; candidateName: string; jobTitle: string; stageLabel: string; dashboardUrl: string };
```

In `subjects`:
```ts
  'referral-submitted':     (data) => `Referral received: ${data.candidateName} for ${data.jobTitle}`,
  'referral-status-update': (data) => `${data.candidateName} update: ${data.stageLabel}`,
```

- [ ] **Step 2: Write failing tests**

`src/lib/services/referralService.test.ts`:
```ts
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
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'r',
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
    // 1 to referrer, 1 per active HR_MANAGER (here: 1)
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

  it('listAllReferrals returns all referrals with job + referrer + linked-application', async () => {
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

    // Candidate registers with the matching email later
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

  it('also bumps referral.status to CONVERTED on the first stage move (APPLIED -> SCREENING)', async () => {
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
```

- [ ] **Step 3: Run — should fail**

- [ ] **Step 4: Implement**

`src/lib/services/referralService.ts`:
```ts
import { Prisma } from '@prisma/client';
import type { AppStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { referralInputSchema, type ReferralInput } from '@/lib/validation/referrals';
import { STAGE_LABEL } from '@/lib/ats/stages';

export type SubmitReferralResult =
  | { ok: true; referralId: string }
  | { ok: false; reason: 'INVALID' | 'JOB_NOT_OPEN' | 'DUPLICATE' };

export async function submitReferral(args: {
  referringUserId: string;
  input: ReferralInput;
}): Promise<SubmitReferralResult> {
  const parsed = referralInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } });
  if (!job || job.status !== 'OPEN') return { ok: false, reason: 'JOB_NOT_OPEN' };

  let referral;
  try {
    referral = await prisma.referral.create({
      data: {
        referringUserId: args.referringUserId,
        jobId: parsed.data.jobId,
        candidateName: parsed.data.candidateName,
        candidateEmail: parsed.data.candidateEmail,
        relationship: parsed.data.relationship,
        resumeUrl: parsed.data.resumeUrl ?? null,
        status: 'SUBMITTED',
      },
    });
  } catch (err) {
    // No DB-level unique constraint on (employee, email, job) yet — we enforce in code.
    // (We re-check after creation to detect race-condition duplicates.)
    throw err;
  }

  // Code-level dedupe: count referrals matching (referringUser, candidateEmail, jobId).
  // If >1 exists, we just created the duplicate — delete and return DUPLICATE.
  const matches = await prisma.referral.findMany({
    where: {
      referringUserId: args.referringUserId,
      candidateEmail: parsed.data.candidateEmail,
      jobId: parsed.data.jobId,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (matches.length > 1) {
    await prisma.referral.delete({ where: { id: referral.id } });
    return { ok: false, reason: 'DUPLICATE' };
  }

  const referrer = await prisma.user.findUniqueOrThrow({ where: { id: args.referringUserId } });

  await recordAudit({
    actorUserId: args.referringUserId,
    action: 'REFERRAL_SUBMITTED',
    entityType: 'Referral',
    entityId: referral.id,
    metadata: { jobId: parsed.data.jobId, candidateEmail: parsed.data.candidateEmail },
  });

  const dashboardUrl = `${process.env.APP_URL ?? ''}/dashboard/employee/referrals`;

  await sendEmail({
    to: referrer.email,
    template: 'referral-submitted',
    data: {
      referrerName: referrer.name,
      candidateName: parsed.data.candidateName,
      jobTitle: job.title,
      dashboardUrl,
    },
  });

  // Fan out to all active HR managers
  const hrGroup = await prisma.user.findMany({ where: { role: 'HR_MANAGER', isActive: true } });
  for (const hr of hrGroup) {
    await sendEmail({
      to: hr.email,
      template: 'referral-submitted',
      data: {
        referrerName: referrer.name,
        candidateName: parsed.data.candidateName,
        jobTitle: job.title,
        dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/hr/referrals`,
      },
    });
  }

  return { ok: true, referralId: referral.id };
}

export async function listMyReferrals(referringUserId: string) {
  return prisma.referral.findMany({
    where: { referringUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, department: true, status: true } },
      application: { select: { id: true, stage: true } },
    },
  });
}

export async function listAllReferrals() {
  return prisma.referral.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, department: true, status: true } },
      referringUser: { select: { id: true, name: true, email: true } },
      application: { select: { id: true, stage: true } },
    },
  });
}

/**
 * Called from registerCandidate when a candidate first signs up.
 * If any pending SUBMITTED referral matches the new candidate's email,
 * mark it CONTACTED. Linkage to the future Application happens at
 * application-submit time (in applicationService.submitApplication).
 */
export async function autoLinkOnCandidateRegistered(args: {
  candidateUserId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: args.candidateUserId } });
  if (!user) return;
  await prisma.referral.updateMany({
    where: { candidateEmail: user.email, status: 'SUBMITTED' },
    data: { status: 'CONTACTED' },
  });
}

/**
 * Called from atsService.moveStage after a successful transition.
 * If the moved application has a linked referral, email the referrer.
 * On the first forward move (APPLIED -> SCREENING) we also bump
 * referral.status to CONVERTED.
 */
export async function notifyReferrerOnStageChange(args: {
  applicationId: string;
  newStage: AppStage;
}): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: {
      job: { select: { title: true } },
      referral: { include: { referringUser: { select: { id: true, name: true, email: true } } } },
      candidate: { select: { name: true } },
    },
  });
  if (!app || !app.referral) return;

  if (args.newStage !== 'APPLIED' && app.referral.status !== 'CONVERTED' && app.referral.status !== 'REJECTED') {
    await prisma.referral.update({
      where: { id: app.referral.id },
      data: { status: args.newStage === 'REJECTED' ? 'REJECTED' : 'CONVERTED' },
    });
  }

  await sendEmail({
    to: app.referral.referringUser.email,
    template: 'referral-status-update',
    data: {
      referrerName: app.referral.referringUser.name,
      candidateName: app.candidate.name,
      jobTitle: app.job.title,
      stageLabel: STAGE_LABEL[args.newStage],
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/employee/referrals`,
    },
  });
}

// Silence unused Prisma import in some bundler configs:
void Prisma;
```

- [ ] **Step 5: Run + commit**

```bash
npm test -- src/lib/services/referralService.test.ts
git add src/lib/services/referralService.ts src/lib/services/referralService.test.ts src/lib/email/templates.ts src/emails/templates/referral-submitted.html src/emails/templates/referral-status-update.html
git commit -m "feat(referrals): add referralService + 2 templates"
```

---

## Task 3: Wire auto-link into registerCandidate + notify-on-stage-change into moveStage

**Files:**
- Modify: `src/lib/services/userService.ts` (call `autoLinkOnCandidateRegistered` after successful candidate create)
- Modify: `src/lib/services/atsService.ts` (call `notifyReferrerOnStageChange` after successful stage move)
- Modify: `src/lib/services/userService.test.ts` (extend tests to assert auto-link fires for a registered candidate with a pre-existing referral)
- Modify: `src/lib/services/atsService.test.ts` (extend tests to assert referrer is notified on stage move when referral exists)

- [ ] **Step 1: Modify `registerCandidate` to call auto-link AFTER create**

Add to `userService.ts`:
```ts
import { autoLinkOnCandidateRegistered } from '@/lib/services/referralService';
```

And inside `registerCandidate`, after the `await sendEmail(...)` call:
```ts
  await autoLinkOnCandidateRegistered({ candidateUserId: user.id });
```

- [ ] **Step 2: Modify `moveStage` to call notify-referrer**

Add to `atsService.ts`:
```ts
import { notifyReferrerOnStageChange } from '@/lib/services/referralService';
```

After the existing `if (args.toStage === 'OFFER') { ... } else { ... }` email block in `moveStage`, before `return { ok: true }`:
```ts
  await notifyReferrerOnStageChange({ applicationId: args.applicationId, newStage: args.toStage });
```

- [ ] **Step 3: Add regression tests**

Append to `src/lib/services/userService.test.ts`:
```ts
describe('registerCandidate auto-links pending referrals', () => {
  beforeEach(async () => { await resetDb(); __resetTransportForTests(); });

  it('marks a pending referral as CONTACTED when the candidate registers', async () => {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const job = await prisma.job.create({
      data: { title: 'J', department: 'D', locationType: 'REMOTE', type: 'FULL_TIME', description: 'd', requirements: 'r', postedById: hr.id, status: 'OPEN' },
    });
    const emp = await prisma.user.create({ data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' } });
    await prisma.referral.create({
      data: { referringUserId: emp.id, jobId: job.id, candidateName: 'Z', candidateEmail: 'z@example.com', relationship: 'colleague', status: 'SUBMITTED' },
    });

    const r = await registerCandidate({ email: 'z@example.com', password: 'Hunter2pass', name: 'Z' });
    expect(r.ok).toBe(true);

    const after = await prisma.referral.findFirstOrThrow({ where: { candidateEmail: 'z@example.com' } });
    expect(after.status).toBe('CONTACTED');
  });
});
```

Append to `src/lib/services/atsService.test.ts`:
```ts
describe('moveStage notifies referrer when application has a referral', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('emails referrer in addition to candidate', async () => {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const j = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!j.ok) throw new Error();
    await publishJob({ jobId: j.jobId, actorUserId: hr.id });

    const emp = await prisma.user.create({ data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' } });
    const ref = await prisma.referral.create({
      data: { referringUserId: emp.id, jobId: j.jobId, candidateName: 'C', candidateEmail: 'c@x.com', relationship: 'r', status: 'SUBMITTED' },
    });
    const cand = await prisma.user.create({
      data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const app = await prisma.application.create({
      data: { jobId: j.jobId, candidateUserId: cand.id, resumeUrl: 'r.pdf', referralId: ref.id },
    });

    __resetTransportForTests();
    const r = await moveStage({ applicationId: app.id, toStage: 'SCREENING', actorUserId: hr.id });
    expect(r.ok).toBe(true);

    const sends = __recordedSendsForTests();
    expect(sends.length).toBe(2);
    expect(sends.some((s) => s.to === cand.email)).toBe(true);
    expect(sends.some((s) => s.to === emp.email)).toBe(true);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test
git add src/lib/services/userService.ts src/lib/services/atsService.ts src/lib/services/userService.test.ts src/lib/services/atsService.test.ts
git commit -m "feat(referrals): wire autoLink into register + notify referrer on stage move"
```

---

## Task 4: Auto-link referral to Application on submitApplication

**Files:**
- Modify: `src/lib/services/applicationService.ts` (after create, attach matching pending referral)
- Modify: `src/lib/services/applicationService.test.ts` (regression test)

The candidate has registered (so any pending referral is now `CONTACTED` and linked by email match). When they actually apply, we set `Application.referralId` if the unique unlinked referral exists for `(candidateEmail, jobId)`.

- [ ] **Step 1: Inside `submitApplication`, after the `prisma.application.create(...)` call**

Add:
```ts
  // Auto-link the application to a matching pending referral (if any).
  // Update only if there's exactly one matching referral not yet linked.
  const matchingReferral = await prisma.referral.findFirst({
    where: {
      jobId: args.jobId,
      candidateEmail: candidate.email,
      applicationId: null,
    },
  });
  if (matchingReferral) {
    await prisma.referral.update({
      where: { id: matchingReferral.id },
      data: { applicationId: app.id },
    });
    await prisma.application.update({
      where: { id: app.id },
      data: { referralId: matchingReferral.id },
    });
  }
```

(Place this between the `prisma.application.create(...)` and the audit/email block.)

- [ ] **Step 2: Add a regression test**

Append to `src/lib/services/applicationService.test.ts`:
```ts
describe('submitApplication auto-links a matching referral', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('links application <-> referral when a pending referral matches', async () => {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const j = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!j.ok) throw new Error();
    await publishJob({ jobId: j.jobId, actorUserId: hr.id });

    const emp = await prisma.user.create({ data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' } });
    const ref = await prisma.referral.create({
      data: { referringUserId: emp.id, jobId: j.jobId, candidateName: 'X', candidateEmail: 'x@x.com', relationship: 'r', status: 'CONTACTED' },
    });

    const cand = await prisma.user.create({
      data: { email: 'x@x.com', name: 'X', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const r = await submitApplication({
      jobId: j.jobId, candidateUserId: cand.id,
      input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const refAfter = await prisma.referral.findUniqueOrThrow({ where: { id: ref.id } });
    expect(refAfter.applicationId).toBe(r.applicationId);

    const appAfter = await prisma.application.findUniqueOrThrow({ where: { id: r.applicationId } });
    expect(appAfter.referralId).toBe(ref.id);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test
git add src/lib/services/applicationService.ts src/lib/services/applicationService.test.ts
git commit -m "feat(referrals): auto-link application <-> referral at submit time"
```

---

## Task 5: Employee referral form (action + page + form component)

**Files:**
- Create: `src/app/dashboard/employee/refer/actions.ts`, `src/app/dashboard/employee/refer/page.tsx`, `src/app/dashboard/employee/refer/ReferForm.tsx`

- [ ] **Step 1: Action**

`src/app/dashboard/employee/refer/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { submitReferral } from '@/lib/services/referralService';
import { referralInputSchema } from '@/lib/validation/referrals';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export async function submitReferralAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  const parsed = referralInputSchema.safeParse({
    jobId: fd.get('jobId'),
    candidateName: fd.get('candidateName'),
    candidateEmail: fd.get('candidateEmail'),
    relationship: fd.get('relationship'),
    resumeUrl: fd.get('resumeUrl') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const r = await submitReferral({ referringUserId: user.id, input: parsed.data });
  if (!r.ok) {
    return {
      error:
        r.reason === 'JOB_NOT_OPEN' ? 'That job is no longer accepting referrals.' :
        r.reason === 'DUPLICATE'    ? "You've already referred that candidate for this role." :
                                       'Something went wrong with this referral.',
    };
  }
  revalidatePath('/dashboard/employee/referrals');
  redirect('/dashboard/employee/referrals?submitted=1');
}
```

- [ ] **Step 2: Form (client)**

`src/app/dashboard/employee/refer/ReferForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { submitReferralAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export function ReferForm({
  openJobs,
}: {
  openJobs: { id: string; title: string; department: string }[];
}) {
  const [state, formAction] = useFormState(submitReferralAction, {} as FormState);
  const [resumeUrl, setResumeUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'supporting-doc');
    fd.append('entityId', 'referral');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setResumeUrl(json.relativePath);
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="jobId">Role</Label>
        <select
          id="jobId" name="jobId" required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select an open role…</option>
          {openJobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="candidateName">Candidate name</Label>
        <Input id="candidateName" name="candidateName" required className="mt-1" />
        {state.fieldErrors?.candidateName && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.candidateName[0]}</p>}
      </div>

      <div>
        <Label htmlFor="candidateEmail">Candidate email</Label>
        <Input id="candidateEmail" name="candidateEmail" type="email" required className="mt-1" />
        {state.fieldErrors?.candidateEmail && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.candidateEmail[0]}</p>}
      </div>

      <div>
        <Label htmlFor="relationship">How do you know them?</Label>
        <Input id="relationship" name="relationship" required placeholder="Former colleague at Acme, friend from school, etc."
               className="mt-1" />
        {state.fieldErrors?.relationship && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.relationship[0]}</p>}
      </div>

      <div>
        <Label htmlFor="resume">Resume (optional)</Label>
        <input
          id="resume"
          type="file"
          accept=".pdf,application/pdf"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {resumeUrl && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="resumeUrl" value={resumeUrl} />
      </div>

      <Button type="submit" disabled={uploading}>Submit referral</Button>
    </form>
  );
}
```

- [ ] **Step 3: Page (server)**

`src/app/dashboard/employee/refer/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listPublicJobs } from '@/lib/services/jobService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ReferForm } from './ReferForm';

export const metadata = { title: 'Refer a candidate · ItsNotTechy Careers' };

export default async function ReferPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  const openJobs = (await listPublicJobs({})).map((j) => ({
    id: j.id, title: j.title, department: j.department,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Refer a candidate</h1>
      <Card>
        <CardTitle>About this referral</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Know someone who&apos;d be a great fit? Tell us about them and we&apos;ll reach out.
          You can track your referrals from your dashboard.
        </p>
        <div className="mt-4">
          <ReferForm openJobs={openJobs} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/dashboard/employee/refer/
git commit -m "feat(referrals): employee referral form with optional resume upload"
```

---

## Task 6: Employee "My Referrals" + HR "All Referrals" pages

**Files:**
- Create: `src/app/dashboard/employee/referrals/page.tsx`
- Create: `src/app/dashboard/hr/referrals/page.tsx`

- [ ] **Step 1: Employee referrals page**

`src/app/dashboard/employee/referrals/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listMyReferrals } from '@/lib/services/referralService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { STAGE_LABEL } from '@/lib/ats/stages';

const REFERRAL_TONE = {
  SUBMITTED: 'neutral', CONTACTED: 'blue', CONVERTED: 'green', REJECTED: 'red',
} as const;

const REFERRAL_LABEL = {
  SUBMITTED: 'Sent invite', CONTACTED: 'Candidate registered',
  CONVERTED: 'Hiring in progress', REJECTED: 'Closed',
} as const;

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  const refs = await listMyReferrals(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My referrals</h1>
        <Link href="/dashboard/employee/refer" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          + Refer a candidate
        </Link>
      </div>

      {searchParams.submitted === '1' && (
        <Alert tone="success">Referral submitted. We&apos;ll keep you posted as it progresses.</Alert>
      )}

      <Card>
        <CardTitle>{refs.length} referral{refs.length === 1 ? '' : 's'}</CardTitle>
        {refs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No referrals yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {refs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-slate-900">{r.candidateName}</div>
                  <div className="text-sm text-slate-500">
                    {r.candidateEmail} · for {r.job.title} ({r.job.department})
                  </div>
                  {r.application && (
                    <div className="mt-1 text-xs text-slate-500">
                      Application stage: <span className="font-medium">{STAGE_LABEL[r.application.stage]}</span>
                    </div>
                  )}
                </div>
                <Badge tone={REFERRAL_TONE[r.status]}>{REFERRAL_LABEL[r.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: HR all-referrals page**

`src/app/dashboard/hr/referrals/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listAllReferrals } from '@/lib/services/referralService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { STAGE_LABEL } from '@/lib/ats/stages';

const REFERRAL_TONE = {
  SUBMITTED: 'neutral', CONTACTED: 'blue', CONVERTED: 'green', REJECTED: 'red',
} as const;

const REFERRAL_LABEL = {
  SUBMITTED: 'Awaiting candidate', CONTACTED: 'Registered',
  CONVERTED: 'Application active', REJECTED: 'Closed',
} as const;

export default async function HrReferralsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const refs = await listAllReferrals();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Referrals</h1>
      <p className="text-sm text-slate-500">{refs.length} total · auto-link runs when the candidate signs up + applies.</p>

      <Card>
        {refs.length === 0 ? (
          <p className="text-sm text-slate-600">No referrals yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {refs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {r.candidateName}{' '}
                    <span className="text-sm font-normal text-slate-500">({r.candidateEmail})</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    Referred by {r.referringUser.name} ({r.referringUser.email}) · for{' '}
                    <Link href={`/dashboard/hr/jobs/${r.job.id}/applicants`} className="hover:underline">{r.job.title}</Link>
                  </div>
                  {r.application && (
                    <div className="mt-1 text-xs text-slate-500">
                      <Link href={`/dashboard/hr/applications/${r.application.id}`} className="text-brand-600 hover:underline">
                        Open application
                      </Link>
                      {' '}— stage: <span className="font-medium">{STAGE_LABEL[r.application.stage]}</span>
                    </div>
                  )}
                </div>
                <Badge tone={REFERRAL_TONE[r.status]}>{REFERRAL_LABEL[r.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/app/dashboard/employee/referrals/ src/app/dashboard/hr/referrals/
git commit -m "feat(referrals): employee 'my referrals' + HR 'all referrals' pages"
```

---

## Task 7: Show "Referred by X" on HR application detail

**Files:**
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx`

`getApplicationForHr` already eagerly loads `referral.referringUser` (Phase 3 prep). The page currently shows a `<Badge tone="blue">Referred</Badge>` placeholder — extend it with the referrer name.

- [ ] **Step 1: Modify the badge area**

Find this block in `src/app/dashboard/hr/applications/[id]/page.tsx`:
```tsx
          <div className="flex items-center gap-2">
            {app.referral && <Badge tone="blue">Referred</Badge>}
            <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
          </div>
```

Replace with:
```tsx
          <div className="flex items-center gap-2">
            {app.referral && (
              <Badge tone="blue">Referred by {app.referral.referringUser.name}</Badge>
            )}
            <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
          </div>
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add "src/app/dashboard/hr/applications/[id]/page.tsx"
git commit -m "feat(hr): show 'Referred by X' on application detail"
```

---

## Task 8: Phase 4 sweep + final review + tag + merge

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [ ] Dispatch a final opus code review
- [ ] Fix anything substantive
- [ ] `git tag phase-4-complete`, fast-forward merge to `main`

---

## End-of-plan state

- Full referral lifecycle: submit → referrer + HR notified → candidate registers (auto-CONTACTED) → candidate applies (auto-link) → stage moves notify referrer + bump status to CONVERTED/REJECTED
- 2 new email templates registered
- Employee can refer + see their referrals
- HR can see all referrals + see "Referred by X" on application detail
- ~185 tests passing

## Out of scope (defer to later phases / v2)
- HR ability to reject a referral manually (REJECTED only set automatically when application is REJECTED)
- Bulk referral CSV import
- Referrer compensation tracking
