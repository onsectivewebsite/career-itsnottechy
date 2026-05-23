# Phase 12 — HR Bulk Stage Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR select multiple applications from an applicants list and Advance, Reject, or Move-to-stage all of them in one action, reusing the existing single-app `moveStage` for atomic claims, audit, and stage emails.

**Architecture:** Extend `atsService` with a `bulkMoveStage` loop that delegates to the existing `moveStage` per id. Add one shared server action `bulkStageAction` and one shared client `BulkActionsBar`. Each list page (`/dashboard/hr/jobs/[id]/applicants` and `/dashboard/hr/applicants`) gets its own client wrapper that maintains a `Set<string>` of selected ids and renders the existing layout with checkboxes + the action bar in one `<form>`.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Vitest.

**Conventions for every task:**
- Node/npm/npx come from nvm — prefix EVERY `npm`/`npx` command with `PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.
- `npm test` runs the full Vitest suite; `npx vitest run <path>` runs one file.
- DB tests target `careers_test` and call `resetDb()` in `beforeEach`.
- Commit after every task with the message in its final step.
- Spec: `docs/superpowers/specs/2026-05-23-phase-12-hr-bulk-stage-actions-design.md`.

---

## Task 1: `bulkMoveStage` service

**Files:**
- Modify: `src/lib/services/atsService.ts`
- Modify: `src/lib/services/atsService.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/services/atsService.test.ts`:
```ts
describe('bulkMoveStage', () => {
  beforeEach(() => resetDb());

  async function setupNApplicants(n: number) {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const j = await createJob({ input: baseJob, postedByUserId: hr.id });
    if (!j.ok) throw new Error();
    await publishJob({ jobId: j.jobId, actorUserId: hr.id });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const cand = await prisma.user.create({
        data: { email: `c${i}@x.com`, name: `Cand ${i}`, role: 'CANDIDATE', candidateProfile: { create: {} } },
      });
      const a = await submitApplication({
        jobId: j.jobId, candidateUserId: cand.id,
        input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
      });
      if (!a.ok) throw new Error();
      ids.push(a.applicationId);
    }
    return { hr, applicationIds: ids };
  }

  it('advance: moves every APPLIED app to SCREENING', async () => {
    const { hr, applicationIds } = await setupNApplicants(3);
    const r = await bulkMoveStage({
      applicationIds, mode: 'advance', actorUserId: hr.id,
    });
    expect(r.applied).toBe(3);
    expect(r.skipped).toEqual([]);
    for (const id of applicationIds) {
      const app = await prisma.application.findUnique({ where: { id } });
      expect(app?.stage).toBe('SCREENING');
    }
  });

  it('advance: terminal apps are skipped with INVALID_TRANSITION', async () => {
    const { hr, applicationIds } = await setupNApplicants(2);
    // Force one to HIRED via the canonical pipeline (APPLIED→SCREENING→INTERVIEW→OFFER→HIRED).
    const [first, second] = applicationIds;
    for (const to of ['SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'] as const) {
      const r = await moveStage({ applicationId: first, toStage: to, actorUserId: hr.id });
      if (!r.ok) throw new Error(`could not move ${first} to ${to}: ${r.reason}`);
    }
    const r = await bulkMoveStage({
      applicationIds: [first, second], mode: 'advance', actorUserId: hr.id,
    });
    expect(r.applied).toBe(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]?.applicationId).toBe(first);
    expect(r.skipped[0]?.reason).toBe('INVALID_TRANSITION');
    const secondApp = await prisma.application.findUnique({ where: { id: second } });
    expect(secondApp?.stage).toBe('SCREENING');
  });

  it('set REJECTED: moves all non-terminal apps to REJECTED', async () => {
    const { hr, applicationIds } = await setupNApplicants(2);
    const r = await bulkMoveStage({
      applicationIds, mode: 'set', toStage: 'REJECTED', actorUserId: hr.id,
    });
    expect(r.applied).toBe(2);
    for (const id of applicationIds) {
      const app = await prisma.application.findUnique({ where: { id } });
      expect(app?.stage).toBe('REJECTED');
    }
  });

  it('unknown id is skipped with NOT_FOUND', async () => {
    const { hr } = await setupNApplicants(1);
    const r = await bulkMoveStage({
      applicationIds: ['no-such-id'], mode: 'advance', actorUserId: hr.id,
    });
    expect(r).toEqual({ applied: 0, skipped: [{ applicationId: 'no-such-id', reason: 'NOT_FOUND' }] });
  });
});
```
Add `bulkMoveStage` to the import from `./atsService` at the top of the test file. `prisma`, `resetDb`, `createJob`, `publishJob`, `submitApplication`, `moveStage`, `baseJob`, and the Vitest helpers are already imported.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/atsService.test.ts`
Expected: FAIL — `bulkMoveStage` is not exported.

- [ ] **Step 3: Implement `bulkMoveStage`**

In `src/lib/services/atsService.ts`:

1. Add to the imports at the top (the file already imports `FORWARD`/`STAGE_NAME` etc. from `@/lib/ats/stages`; keep that import as-is and just confirm `FORWARD` is already imported — if not, extend the import):
```ts
import { FORWARD, isValidTransition } from '@/lib/ats/stages';
```
(If `FORWARD` is not already imported, add it. `isValidTransition` may already be imported — leave as-is.)

2. Append at the end of the file:
```ts
export type BulkMoveResult = {
  applied: number;
  skipped: { applicationId: string; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' }[];
};

export type BulkMoveInput = {
  applicationIds: string[];
  mode: 'advance' | 'set';
  toStage?: AppStage;
  actorUserId: string;
};

/**
 * Sequentially move every selected application through the existing single-app
 * `moveStage` (atomic claim + audit + stage email). Returns a per-app summary;
 * never throws on a single failed item.
 */
export async function bulkMoveStage(args: BulkMoveInput): Promise<BulkMoveResult> {
  const skipped: BulkMoveResult['skipped'] = [];
  let applied = 0;

  for (const id of args.applicationIds) {
    const app = await prisma.application.findUnique({
      where: { id },
      select: { stage: true },
    });
    if (!app) {
      skipped.push({ applicationId: id, reason: 'NOT_FOUND' });
      continue;
    }

    let target: AppStage | undefined;
    if (args.mode === 'advance') {
      target = FORWARD[app.stage][0]; // first forward = the natural advance, never REJECTED for non-terminal stages
    } else {
      target = args.toStage;
    }

    if (!target) {
      skipped.push({ applicationId: id, reason: 'INVALID_TRANSITION' });
      continue;
    }

    const r = await moveStage({ applicationId: id, toStage: target, actorUserId: args.actorUserId });
    if (r.ok) {
      applied++;
    } else {
      skipped.push({ applicationId: id, reason: r.reason });
    }
  }

  return { applied, skipped };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/atsService.test.ts`
Expected: PASS — all `atsService` tests green.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/atsService.ts src/lib/services/atsService.test.ts
git commit -m "feat(ats): add bulkMoveStage"
```

---

## Task 2: `bulkStageAction` server action

**Files:**
- Create: `src/app/dashboard/hr/_actions/bulkStageAction.ts`

The `_actions` folder name has a leading underscore so Next.js treats it as a private (non-routable) directory.

- [ ] **Step 1: Create the action**

`src/app/dashboard/hr/_actions/bulkStageAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { AppStage } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { bulkMoveStage } from '@/lib/services/atsService';

export type BulkStageFormState = {
  error?: string;
  ok?: true;
  summary?: string;
};

const VALID_STAGES: AppStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export async function bulkStageAction(
  _prev: BulkStageFormState | undefined,
  fd: FormData,
): Promise<BulkStageFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const applicationIds = fd.getAll('applicationIds').map(String).filter(Boolean);
  if (applicationIds.length === 0) {
    return { error: 'Pick at least one applicant.' };
  }

  const bulkAction = String(fd.get('bulkAction') ?? '');
  const toStageRaw = String(fd.get('toStage') ?? '');

  let result;
  if (bulkAction === 'advance') {
    result = await bulkMoveStage({ applicationIds, mode: 'advance', actorUserId: user.id });
  } else if (bulkAction === 'reject') {
    result = await bulkMoveStage({ applicationIds, mode: 'set', toStage: 'REJECTED', actorUserId: user.id });
  } else if (bulkAction === 'set') {
    if (!VALID_STAGES.includes(toStageRaw as AppStage)) {
      return { error: 'Pick a target stage.' };
    }
    result = await bulkMoveStage({
      applicationIds, mode: 'set', toStage: toStageRaw as AppStage, actorUserId: user.id,
    });
  } else {
    return { error: 'Pick an action.' };
  }

  revalidatePath('/dashboard/hr/applicants');
  revalidatePath('/dashboard/hr/jobs/[id]/applicants', 'page');

  const skippedCount = result.skipped.length;
  const summary = skippedCount === 0
    ? `${result.applied} moved.`
    : `${result.applied} moved, ${skippedCount} skipped.`;
  return { ok: true, summary };
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds (nothing imports the action yet — this just checks it compiles).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/hr/_actions/bulkStageAction.ts
git commit -m "feat(ats): add bulkStageAction server action"
```

---

## Task 3: `BulkActionsBar` shared client component

**Files:**
- Create: `src/components/applicants/BulkActionsBar.tsx`

- [ ] **Step 1: Create the component**

`src/components/applicants/BulkActionsBar.tsx`:
```tsx
'use client';

import { STAGE_LABEL, STAGE_ORDER } from '@/lib/ats/stages';
import { Button } from '@/components/ui/Button';

/**
 * The bulk-action controls rendered inside the per-page <form>.
 * Buttons submit the surrounding form with name=bulkAction value=<advance|reject|set>.
 * Reject is gated by window.confirm to prevent accidents.
 */
export function BulkActionsBar({ selectedCount }: { selectedCount: number }) {
  const disabled = selectedCount === 0;

  function confirmReject(e: React.MouseEvent<HTMLButtonElement>) {
    const ok = window.confirm(
      `Reject ${selectedCount} application${selectedCount === 1 ? '' : 's'}? This can only be reversed by moving them back to another stage manually.`,
    );
    if (!ok) e.preventDefault();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-slate-900">
        {selectedCount === 0 ? 'Select applicants to act on them' : `${selectedCount} selected`}
      </span>

      <Button type="submit" name="bulkAction" value="advance" size="sm" disabled={disabled}>
        Advance
      </Button>

      <Button
        type="submit"
        name="bulkAction"
        value="reject"
        size="sm"
        variant="danger"
        disabled={disabled}
        onClick={confirmReject}
      >
        Reject
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Move to:</span>
        <select
          name="toStage"
          defaultValue=""
          disabled={disabled}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="" disabled>— pick stage —</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s]}</option>
          ))}
        </select>
        <Button type="submit" name="bulkAction" value="set" size="sm" variant="secondary" disabled={disabled}>
          Move
        </Button>
      </div>
    </div>
  );
}
```

The `Button` component forwards rest props to the underlying `<button>`, so `name`, `value`, and `onClick` pass through.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/applicants/BulkActionsBar.tsx
git commit -m "feat(ats): add BulkActionsBar shared component"
```

---

## Task 4: Per-job page — `BulkApplicantsByStage`

**Files:**
- Create: `src/app/dashboard/hr/jobs/[id]/applicants/BulkApplicantsByStage.tsx`
- Modify: `src/app/dashboard/hr/jobs/[id]/applicants/page.tsx`

- [ ] **Step 1: Create the client wrapper**

`src/app/dashboard/hr/jobs/[id]/applicants/BulkApplicantsByStage.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { STAGE_ORDER, STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { BulkActionsBar } from '@/components/applicants/BulkActionsBar';
import { bulkStageAction, type BulkStageFormState } from '@/app/dashboard/hr/_actions/bulkStageAction';

export type AppRow = {
  id: string;
  stage: AppStage;
  createdAt: Date;
  candidate: { name: string; email: string };
};

export function BulkApplicantsByStage({ apps }: { apps: AppRow[] }) {
  const [state, formAction] = useFormState(bulkStageAction, {} as BulkStageFormState);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const byStage: Record<AppStage, AppRow[]> = {
    APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: [],
  };
  for (const a of apps) byStage[a.stage].push(a);

  return (
    <form action={formAction} className="space-y-4">
      <BulkActionsBar selectedCount={selected.size} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok    && <Alert tone="success">{state.summary}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STAGE_ORDER.map((stage) => (
          <Card key={stage}>
            <div className="flex items-center justify-between">
              <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {byStage[stage].map((app) => (
                <li
                  key={app.id}
                  className="flex gap-2 rounded-md border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    name="applicationIds"
                    value={app.id}
                    checked={selected.has(app.id)}
                    onChange={() => toggle(app.id)}
                    aria-label={`Select ${app.candidate.name}`}
                    className="mt-1"
                  />
                  <Link href={`/dashboard/hr/applications/${app.id}`} className="flex-1 text-sm">
                    <div className="font-medium text-slate-900">{app.candidate.name}</div>
                    <div className="text-xs text-slate-500">{app.candidate.email}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Applied {new Date(app.createdAt).toISOString().slice(0, 10)}
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
    </form>
  );
}
```

- [ ] **Step 2: Wire the wrapper into the page**

Replace the entire contents of `src/app/dashboard/hr/jobs/[id]/applicants/page.tsx` with:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listApplicationsForJob } from '@/lib/services/atsService';
import { BulkApplicantsByStage, type AppRow } from './BulkApplicantsByStage';

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const apps = await listApplicationsForJob(params.id);

  const rows: AppRow[] = apps.map((a) => ({
    id: a.id,
    stage: a.stage,
    createdAt: a.createdAt,
    candidate: { name: a.candidate.name, email: a.candidate.email },
  }));

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

      <BulkApplicantsByStage apps={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/hr/jobs/[id]/applicants/BulkApplicantsByStage.tsx src/app/dashboard/hr/jobs/[id]/applicants/page.tsx
git commit -m "feat(ats): bulk actions on per-job applicants page"
```

---

## Task 5: All-applicants page — `BulkApplicantsFlat`

**Files:**
- Create: `src/app/dashboard/hr/applicants/BulkApplicantsFlat.tsx`
- Modify: `src/app/dashboard/hr/applicants/page.tsx`

- [ ] **Step 1: Create the client wrapper**

`src/app/dashboard/hr/applicants/BulkApplicantsFlat.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import type { AppStage } from '@prisma/client';
import { STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { BulkActionsBar } from '@/components/applicants/BulkActionsBar';
import { bulkStageAction, type BulkStageFormState } from '@/app/dashboard/hr/_actions/bulkStageAction';

export type AppFlatRow = {
  id: string;
  stage: AppStage;
  hasReferral: boolean;
  candidate: { name: string; email: string };
  job: { id: string; title: string };
};

export function BulkApplicantsFlat({ apps }: { apps: AppFlatRow[] }) {
  const [state, formAction] = useFormState(bulkStageAction, {} as BulkStageFormState);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <BulkActionsBar selectedCount={selected.size} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok    && <Alert tone="success">{state.summary}</Alert>}

      <Card>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-600">No active applications.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  name="applicationIds"
                  value={app.id}
                  checked={selected.has(app.id)}
                  onChange={() => toggle(app.id)}
                  aria-label={`Select ${app.candidate.name}`}
                />
                <div className="flex-1">
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
                <div className="flex items-center gap-2">
                  {app.hasReferral && <Badge tone="blue">Referred</Badge>}
                  <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </form>
  );
}
```

- [ ] **Step 2: Wire the wrapper into the page**

Replace the entire contents of `src/app/dashboard/hr/applicants/page.tsx` with:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listActiveApplicationsForHr } from '@/lib/services/atsService';
import { BulkApplicantsFlat, type AppFlatRow } from './BulkApplicantsFlat';

export default async function HrApplicantsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const apps = await listActiveApplicationsForHr();

  const rows: AppFlatRow[] = apps.map((a) => ({
    id: a.id,
    stage: a.stage,
    hasReferral: a.referral !== null,
    candidate: { name: a.candidate.name, email: a.candidate.email },
    job: { id: a.job.id, title: a.job.title },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Active applicants</h1>
      <p className="text-sm text-slate-500">{apps.length} active application{apps.length === 1 ? '' : 's'} across all open jobs.</p>

      <BulkApplicantsFlat apps={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Verify the build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/hr/applicants/BulkApplicantsFlat.tsx src/app/dashboard/hr/applicants/page.tsx
git commit -m "feat(ats): bulk actions on all-applicants page"
```

---

# Final verification

After Task 5:

- [ ] `npm test` — all green
- [ ] `npm run build` — succeeds
- [ ] Manual smoke test: as HR, open `/dashboard/hr/jobs/[id]/applicants`, select two `APPLIED` rows, click Advance, confirm they move to SCREENING and a success alert shows "2 moved."; select one of those plus one `HIRED` row, click Advance, confirm the alert reads "1 moved, 1 skipped."; pick a row, choose REJECTED from the "Move to" select, confirm the Reject browser prompt appears; verify the same flow on `/dashboard/hr/applicants`.

Then deploy per the runbook: rsync, `npm ci` (no new deps but safe), `npm run build`, `pm2 restart`. No database migration is required for this phase.
