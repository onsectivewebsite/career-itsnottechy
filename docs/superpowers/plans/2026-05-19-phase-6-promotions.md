# Phase 6 — Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employee submits a promotion request → their direct manager approves or rejects with notes → if approved, HR makes the final call. Three emails fire at each step (submitted, manager decision, HR decision). Each stakeholder has a dashboard surface: employee tracker, manager inbox, HR final-decision queue.

**Architecture:**
- New `promotionService` owns `submitPromotion`, `managerDecision`, `hrDecision`, plus three list helpers (`listMine`, `listForManager`, `listForHr`).
- State machine on `PromotionRequest.finalStatus`: `PENDING_MANAGER → PENDING_HR | REJECTED` (manager step), then `PENDING_HR → APPROVED | REJECTED` (HR step). Each step writes a `Decision` + notes + decidedAt and is gated by an atomic `updateMany` claim on the prior status — same race-safe pattern as `moveStage` and `consumeInviteToken` from earlier phases.
- Each decision is also scoped: a Manager may only decide on a request where `managerUserId === session.userId`; HR may only decide on `PENDING_HR` requests. RBAC enforced at the service layer AND the page layer per the established pattern.
- Email templates added per spec §9: `promotion-submitted` (to submitter + assigned manager), `promotion-manager-decision` (to submitter + HR distribution), `promotion-final-decision` (to submitter + manager).
- Supporting doc is optional, uploaded via existing `/api/upload` with `purpose='supporting-doc'`.

**Tech Stack:** Next 14 / TS strict + noUncheckedIndexedAccess / Prisma / vitest / Tailwind. Same as prior phases.

**Prerequisites:** Phase 5 complete (tag `phase-5-complete`). 198 tests passing.

**End-of-plan state:** Full promotion lifecycle (request → manager approve/reject → HR final decision) shipping. 3 new email templates. Employee/Manager/HR dashboards extended. ~215 tests total.

---

## Important schema note

`Employee.managerId` references **`Employee.id`** (NOT `User.id`). To compute the `managerUserId` for a new `PromotionRequest`, the service must read the submitter's `Employee` row, follow `managerId` to the manager's `Employee` row, and then take that row's `userId`. Use Prisma's `include: { manager: { include: { user: true } } }` or two lookups. If the submitter has no `Employee` row or no `managerId`, return `NO_MANAGER`.

---

## Task 1: Promotion validation + types

**Files:**
- Create: `src/lib/validation/promotions.ts`, `src/lib/validation/promotions.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/validation/promotions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { promotionInputSchema, decisionInputSchema } from './promotions';

describe('promotionInputSchema', () => {
  it('accepts a minimal valid promotion', () => {
    const r = promotionInputSchema.parse({
      currentTitle: 'Engineer II',
      targetTitle: 'Senior Engineer',
      justification: 'I led the migration project for six months and shipped on time.',
    });
    expect(r.supportingDocUrl).toBeUndefined();
    expect(r.currentTitle).toBe('Engineer II');
  });

  it('trims and lowercases nothing structural; just trims', () => {
    const r = promotionInputSchema.parse({
      currentTitle: '  Engineer II  ',
      targetTitle: '  Senior Engineer  ',
      justification: '  done lots of work over six months consistently  ',
    });
    expect(r.currentTitle).toBe('Engineer II');
    expect(r.targetTitle).toBe('Senior Engineer');
    expect(r.justification).toBe('done lots of work over six months consistently');
  });

  it('rejects an empty currentTitle / targetTitle', () => {
    expect(() => promotionInputSchema.parse({
      currentTitle: '', targetTitle: 'X', justification: 'long enough justification text',
    })).toThrow();
    expect(() => promotionInputSchema.parse({
      currentTitle: 'X', targetTitle: '', justification: 'long enough justification text',
    })).toThrow();
  });

  it('rejects justification shorter than 20 chars', () => {
    expect(() => promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B', justification: 'too short',
    })).toThrow();
  });

  it('accepts optional supportingDocUrl', () => {
    const r = promotionInputSchema.parse({
      currentTitle: 'A', targetTitle: 'B',
      justification: 'long enough justification text here',
      supportingDocUrl: 'supporting-doc/promotion/x.pdf',
    });
    expect(r.supportingDocUrl).toBe('supporting-doc/promotion/x.pdf');
  });
});

describe('decisionInputSchema', () => {
  it('accepts APPROVED with optional notes', () => {
    const r = decisionInputSchema.parse({ decision: 'APPROVED' });
    expect(r.decision).toBe('APPROVED');
    expect(r.notes).toBeUndefined();
  });

  it('accepts REJECTED with notes', () => {
    const r = decisionInputSchema.parse({ decision: 'REJECTED', notes: '  not yet ready  ' });
    expect(r.notes).toBe('not yet ready');
  });

  it('rejects an unknown decision', () => {
    expect(() => decisionInputSchema.parse({ decision: 'MAYBE' })).toThrow();
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/validation/promotions.ts`:
```ts
import { z } from 'zod';

export const promotionInputSchema = z.object({
  currentTitle: z.string().trim().min(1).max(200),
  targetTitle:  z.string().trim().min(1).max(200),
  justification: z.string().trim().min(20, 'Justification must be at least 20 characters.').max(5000),
  supportingDocUrl: z.string().min(1).optional(),
});
export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const decisionInputSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes:    z.string().trim().max(2000).optional(),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;
```

- [ ] **Step 4: Run + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test -- src/lib/validation/promotions.test.ts
git add src/lib/validation/promotions.ts src/lib/validation/promotions.test.ts
git commit -m "feat(validation): add promotion input + decision schemas"
```

---

## Task 2: Email templates + registry entries

**Files:**
- Create: `src/emails/templates/promotion-submitted.html`, `promotion-manager-decision.html`, `promotion-final-decision.html`
- Modify: `src/lib/email/templates.ts` (add 3 entries to `TemplateData` and `subjects`)
- Modify: `src/lib/email/templates.test.ts` (add 3 render tests)

- [ ] **Step 1: Create the three HTML templates**

`src/emails/templates/promotion-submitted.html`:
```html
<p>Hi {{recipientName}},</p>
<p>A promotion request has been submitted:</p>
<ul>
  <li><strong>Employee:</strong> {{employeeName}}</li>
  <li><strong>From:</strong> {{currentTitle}}</li>
  <li><strong>To:</strong> {{targetTitle}}</li>
</ul>
<p>{{contextLine}}</p>
<p><a class="btn" href="{{dashboardUrl}}">Open request</a></p>
```

`src/emails/templates/promotion-manager-decision.html`:
```html
<p>Hi {{recipientName}},</p>
<p>The manager has reviewed <strong>{{employeeName}}</strong>'s promotion request from <strong>{{currentTitle}}</strong> to <strong>{{targetTitle}}</strong>.</p>
<p><strong>Decision:</strong> {{decisionLabel}}</p>
{{{notesBlock}}}
<p>{{nextStepLine}}</p>
<p><a class="btn" href="{{dashboardUrl}}">Open request</a></p>
```

`src/emails/templates/promotion-final-decision.html`:
```html
<p>Hi {{recipientName}},</p>
<p>HR has issued the final decision on <strong>{{employeeName}}</strong>'s promotion request from <strong>{{currentTitle}}</strong> to <strong>{{targetTitle}}</strong>.</p>
<p><strong>Final decision:</strong> {{decisionLabel}}</p>
{{{notesBlock}}}
<p><a class="btn" href="{{dashboardUrl}}">Open request</a></p>
```

**Renderer note:** triple-brace `{{{notesBlock}}}` is required because the service writes pre-rendered HTML into that variable. Double-brace would HTML-escape the `<p>` tags (see Phase 5 fix #1 retrospective).

- [ ] **Step 2: Extend `src/lib/email/templates.ts`**

Add three entries to `TemplateData`:
```ts
  'promotion-submitted': {
    recipientName: string;
    employeeName: string;
    currentTitle: string;
    targetTitle: string;
    contextLine: string;       // "You submitted this request." / "Please review and approve or reject."
    dashboardUrl: string;
  };
  'promotion-manager-decision': {
    recipientName: string;
    employeeName: string;
    currentTitle: string;
    targetTitle: string;
    decisionLabel: string;     // "Approved" / "Rejected"
    notesBlock: string;        // pre-rendered HTML <p>...</p> or ''
    nextStepLine: string;      // "Forwarded to HR for final decision." or "This request is now closed."
    dashboardUrl: string;
  };
  'promotion-final-decision': {
    recipientName: string;
    employeeName: string;
    currentTitle: string;
    targetTitle: string;
    decisionLabel: string;
    notesBlock: string;
    dashboardUrl: string;
  };
```

Add three entries to `subjects`:
```ts
  'promotion-submitted':        (d) => `Promotion request — ${d.employeeName}: ${d.currentTitle} → ${d.targetTitle}`,
  'promotion-manager-decision': (d) => `Promotion ${d.decisionLabel.toLowerCase()} by manager — ${d.employeeName}`,
  'promotion-final-decision':   (d) => `Promotion ${d.decisionLabel.toLowerCase()} (final) — ${d.employeeName}`,
```

- [ ] **Step 3: Add 3 render tests to `src/lib/email/templates.test.ts`**

Append:
```ts
describe('renderTemplate promotion-submitted', () => {
  it('renders submitter + employee + title transition', () => {
    const html = renderTemplate('promotion-submitted', {
      recipientName: 'Manager Mike',
      employeeName: 'Alice',
      currentTitle: 'Engineer II',
      targetTitle: 'Senior Engineer',
      contextLine: 'Please review this request and decide.',
      dashboardUrl: 'https://x.com/dashboard/manager/promotions',
    });
    expect(html).toContain('Manager Mike');
    expect(html).toContain('Alice');
    expect(html).toContain('Engineer II');
    expect(html).toContain('Senior Engineer');
    expect(html).toContain('Please review this request and decide.');
  });

  it('subject contains employee name and title transition', () => {
    expect(subjectFor('promotion-submitted', {
      recipientName: 'r', employeeName: 'Alice',
      currentTitle: 'Engineer II', targetTitle: 'Senior Engineer',
      contextLine: 'x', dashboardUrl: 'x',
    })).toBe('Promotion request — Alice: Engineer II → Senior Engineer');
  });
});

describe('renderTemplate promotion-manager-decision', () => {
  it('renders notesBlock as RAW HTML (triple-brace)', () => {
    const html = renderTemplate('promotion-manager-decision', {
      recipientName: 'Alice', employeeName: 'Alice',
      currentTitle: 'A', targetTitle: 'B',
      decisionLabel: 'Approved',
      notesBlock: '<p><strong>Notes:</strong> great work</p>',
      nextStepLine: 'Forwarded to HR for final decision.',
      dashboardUrl: 'https://x.com/dashboard/employee/promotions',
    });
    expect(html).toContain('<p><strong>Notes:</strong> great work</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });
});

describe('renderTemplate promotion-final-decision', () => {
  it('renders final decision label', () => {
    const html = renderTemplate('promotion-final-decision', {
      recipientName: 'Alice', employeeName: 'Alice',
      currentTitle: 'A', targetTitle: 'B',
      decisionLabel: 'Rejected',
      notesBlock: '',
      dashboardUrl: 'https://x.com/d',
    });
    expect(html).toContain('Rejected');
    expect(html).not.toContain('Notes:');
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test
git add src/emails/templates/promotion-submitted.html src/emails/templates/promotion-manager-decision.html src/emails/templates/promotion-final-decision.html src/lib/email/templates.ts src/lib/email/templates.test.ts
git commit -m "feat(email): add 3 promotion templates + render tests"
```

Test count: 198 + 4 new = 202.

---

## Task 3: promotionService — submit + decide + list

**Files:**
- Create: `src/lib/services/promotionService.ts`, `src/lib/services/promotionService.test.ts`

**Behavior contract:**
- `submitPromotion({ employeeUserId, input })` — validates input; resolves the submitter's `managerUserId` via `Employee.manager.user.id`; if no manager, returns `NO_MANAGER`. Creates the row with `finalStatus = PENDING_MANAGER`, writes audit, fires email #10 to submitter (context: "You submitted this request") AND to assigned manager (context: "Please review and approve or reject").
- `managerDecision({ promotionId, actorUserId, decision, notes })` — RBAC: only the assigned manager may decide. Atomically claims the row from `PENDING_MANAGER` to either `PENDING_HR` (on APPROVED) or `REJECTED` (on REJECTED). Writes `managerDecision`, `managerNotes`, `managerDecidedAt`. Audit + email #11 to submitter + HR distribution (when APPROVED → "Forwarded to HR"; when REJECTED → "This request is now closed").
- `hrDecision({ promotionId, actorUserId, decision, notes })` — atomically claims from `PENDING_HR` to `APPROVED` or `REJECTED`. Writes `hrDecision`, `hrNotes`, `hrDecidedAt`. Audit + email #12 to submitter + manager.
- `listMine(userId)` returns submitter's requests, desc by createdAt, with `manager.user.name`.
- `listForManager(managerUserId)` returns requests where `managerUserId === userId` AND `finalStatus = PENDING_MANAGER`, asc by createdAt. (Decided requests fall out of the inbox.)
- `listForHr()` returns `finalStatus = PENDING_HR`, asc by createdAt, with submitter + manager info.

- [ ] **Step 1: Write failing tests**

`src/lib/services/promotionService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  submitPromotion,
  managerDecision,
  hrDecision,
  listMine,
  listForManager,
  listForHr,
} from './promotionService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

async function setupChain() {
  // HR + Manager + Employee with manager link
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const managerUser = await prisma.user.create({
    data: { email: 'mgr@x.com', name: 'Mgr', role: 'MANAGER' },
  });
  const managerEmp = await prisma.employee.create({
    data: { userId: managerUser.id, employeeCode: 'M001', department: 'Eng', title: 'Eng Manager', hireDate: new Date(), managerId: null },
  });
  const empUser = await prisma.user.create({
    data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' },
  });
  await prisma.employee.create({
    data: { userId: empUser.id, employeeCode: 'E001', department: 'Eng', title: 'Engineer II', hireDate: new Date(), managerId: managerEmp.id },
  });
  return { hr, managerUser, managerEmp, empUser };
}

const baseInput = {
  currentTitle: 'Engineer II',
  targetTitle: 'Senior Engineer',
  justification: 'Led the migration project for six months and shipped on time.',
};

describe('submitPromotion', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates a PENDING_MANAGER request and emails submitter + manager', async () => {
    const { managerUser, empUser } = await setupChain();
    __resetTransportForTests();
    const r = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: r.promotionId } });
    expect(row.finalStatus).toBe('PENDING_MANAGER');
    expect(row.managerUserId).toBe(managerUser.id);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(2);
    const toEmails = sends.map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, managerUser.email].sort());

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'PROMOTION_SUBMITTED')).toBe(true);
  });

  it('returns NO_MANAGER when the employee has no manager set', async () => {
    const empUser = await prisma.user.create({ data: { email: 'lone@x.com', name: 'Lone', role: 'EMPLOYEE' } });
    await prisma.employee.create({
      data: { userId: empUser.id, employeeCode: 'L001', department: 'X', title: 'Solo', hireDate: new Date(), managerId: null },
    });
    const r = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    expect(r).toEqual({ ok: false, reason: 'NO_MANAGER' });
  });

  it('returns NO_EMPLOYEE_ROW when the user has no Employee record', async () => {
    const candUser = await prisma.user.create({
      data: { email: 'cand@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const r = await submitPromotion({ employeeUserId: candUser.id, input: baseInput });
    expect(r).toEqual({ ok: false, reason: 'NO_EMPLOYEE_ROW' });
  });
});

describe('managerDecision', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('APPROVE moves PENDING_MANAGER → PENDING_HR, emails submitter + HR group', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();

    __resetTransportForTests();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: managerUser.id,
      decision: 'APPROVED', notes: 'Great fit.',
    });
    expect(r.ok).toBe(true);

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('PENDING_HR');
    expect(row.managerDecision).toBe('APPROVED');
    expect(row.managerNotes).toBe('Great fit.');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, hr.email].sort());
  });

  it('REJECT moves PENDING_MANAGER → REJECTED, emails submitter + HR group', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();

    __resetTransportForTests();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: managerUser.id,
      decision: 'REJECTED', notes: 'Not yet.',
    });
    expect(r.ok).toBe(true);

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('REJECTED');
    expect(row.managerDecision).toBe('REJECTED');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, hr.email].sort());
  });

  it('refuses NOT_MANAGER when actor is not the assigned manager', async () => {
    const { empUser } = await setupChain();
    const stranger = await prisma.user.create({ data: { email: 'x@x.com', name: 'X', role: 'MANAGER' } });
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: stranger.id, decision: 'APPROVED',
    });
    expect(r).toEqual({ ok: false, reason: 'NOT_MANAGER' });
  });

  it('refuses WRONG_STATUS if request is no longer PENDING_MANAGER', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    const r2 = await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'REJECTED' });
    expect(r2).toEqual({ ok: false, reason: 'WRONG_STATUS' });
  });

  it('two concurrent decisions: exactly one wins', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    __resetTransportForTests();
    const [a, b] = await Promise.all([
      managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' }),
      managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'REJECTED' }),
    ]);
    const wins = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: 'WRONG_STATUS' });

    // Only one decision-email round (2 emails: submitter + HR), not two rounds.
    expect(__recordedSendsForTests()).toHaveLength(2);
  });
});

describe('hrDecision', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('APPROVE moves PENDING_HR → APPROVED, emails submitter + manager', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });

    __resetTransportForTests();
    const r = await hrDecision({ promotionId: sub.promotionId, actorUserId: hr.id, decision: 'APPROVED' });
    expect(r.ok).toBe(true);
    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('APPROVED');
    expect(row.hrDecision).toBe('APPROVED');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, managerUser.email].sort());
  });

  it('refuses WRONG_STATUS if request is not PENDING_HR', async () => {
    const { hr, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    const r = await hrDecision({ promotionId: sub.promotionId, actorUserId: hr.id, decision: 'APPROVED' });
    expect(r).toEqual({ ok: false, reason: 'WRONG_STATUS' });
  });
});

describe('list helpers', () => {
  beforeEach(() => resetDb());

  it('listMine returns the submitter\'s requests', async () => {
    const { empUser } = await setupChain();
    await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    const list = await listMine(empUser.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.currentTitle).toBe('Engineer II');
  });

  it('listForManager returns only PENDING_MANAGER for that manager', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    let inbox = await listForManager(managerUser.id);
    expect(inbox).toHaveLength(1);

    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    inbox = await listForManager(managerUser.id);
    expect(inbox).toHaveLength(0);
  });

  it('listForHr returns only PENDING_HR', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    expect(await listForHr()).toHaveLength(0);

    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    expect(await listForHr()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/services/promotionService.ts`:
```ts
import type { Decision } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { promotionInputSchema, type PromotionInput } from '@/lib/validation/promotions';

export type SubmitResult =
  | { ok: true; promotionId: string }
  | { ok: false; reason: 'INVALID' | 'NO_EMPLOYEE_ROW' | 'NO_MANAGER' };

const DECISION_LABEL: Record<Decision, string> = { APPROVED: 'Approved', REJECTED: 'Rejected' };

const APP_URL = () => process.env.APP_URL ?? '';
const EMPLOYEE_DASH = () => `${APP_URL()}/dashboard/employee/promotions`;
const MANAGER_DASH  = () => `${APP_URL()}/dashboard/manager/promotions`;
const HR_DASH       = () => `${APP_URL()}/dashboard/hr/promotions`;

export async function submitPromotion(args: {
  employeeUserId: string;
  input: PromotionInput | Record<string, unknown>;
}): Promise<SubmitResult> {
  const parsed = promotionInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  // Resolve the submitter's Employee row + manager chain
  const employee = await prisma.employee.findUnique({
    where: { userId: args.employeeUserId },
    include: { user: true, manager: { include: { user: true } } },
  });
  if (!employee) return { ok: false, reason: 'NO_EMPLOYEE_ROW' };
  if (!employee.manager) return { ok: false, reason: 'NO_MANAGER' };
  const managerUser = employee.manager.user;

  const row = await prisma.promotionRequest.create({
    data: {
      employeeUserId: args.employeeUserId,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      justification: parsed.data.justification,
      supportingDocUrl: parsed.data.supportingDocUrl ?? null,
      managerUserId: managerUser.id,
      finalStatus: 'PENDING_MANAGER',
    },
  });

  await recordAudit({
    actorUserId: args.employeeUserId,
    action: 'PROMOTION_SUBMITTED',
    entityType: 'PromotionRequest',
    entityId: row.id,
    metadata: { managerUserId: managerUser.id },
  });

  // Email submitter
  await sendEmail({
    to: employee.user.email,
    template: 'promotion-submitted',
    data: {
      recipientName: employee.user.name,
      employeeName: employee.user.name,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      contextLine: 'You submitted this request. We\'ll email you as it progresses.',
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  // Email assigned manager
  await sendEmail({
    to: managerUser.email,
    template: 'promotion-submitted',
    data: {
      recipientName: managerUser.name,
      employeeName: employee.user.name,
      currentTitle: parsed.data.currentTitle,
      targetTitle: parsed.data.targetTitle,
      contextLine: 'Please review this request and approve or reject.',
      dashboardUrl: MANAGER_DASH(),
    },
  });

  return { ok: true, promotionId: row.id };
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_MANAGER' | 'WRONG_STATUS' };

export async function managerDecision(args: {
  promotionId: string;
  actorUserId: string;
  decision: Decision;
  notes?: string;
}): Promise<DecisionResult> {
  const existing = await prisma.promotionRequest.findUnique({
    where: { id: args.promotionId },
    include: { employee: true, manager: true },
  });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.managerUserId !== args.actorUserId) return { ok: false, reason: 'NOT_MANAGER' };

  // Atomic claim from PENDING_MANAGER → PENDING_HR / REJECTED based on decision.
  const newStatus = args.decision === 'APPROVED' ? 'PENDING_HR' : 'REJECTED';
  const claim = await prisma.promotionRequest.updateMany({
    where: { id: args.promotionId, finalStatus: 'PENDING_MANAGER' },
    data: {
      managerDecision: args.decision,
      managerNotes: args.notes ?? null,
      managerDecidedAt: new Date(),
      finalStatus: newStatus,
    },
  });
  if (claim.count === 0) return { ok: false, reason: 'WRONG_STATUS' };

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'PROMOTION_MANAGER_DECIDED',
    entityType: 'PromotionRequest',
    entityId: args.promotionId,
    metadata: { decision: args.decision, newStatus },
  });

  const notesBlock = args.notes
    ? `<p><strong>Manager notes:</strong> ${escapeHtml(args.notes)}</p>`
    : '';
  const nextStepLine = args.decision === 'APPROVED'
    ? 'Forwarded to HR for final decision.'
    : 'This request is now closed.';

  // Email submitter
  await sendEmail({
    to: existing.employee.email,
    template: 'promotion-manager-decision',
    data: {
      recipientName: existing.employee.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      nextStepLine,
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  // Fan-out to HR distribution
  const hrGroup = await prisma.user.findMany({ where: { role: 'HR_MANAGER', isActive: true } });
  for (const hr of hrGroup) {
    await sendEmail({
      to: hr.email,
      template: 'promotion-manager-decision',
      data: {
        recipientName: hr.name,
        employeeName: existing.employee.name,
        currentTitle: existing.currentTitle,
        targetTitle: existing.targetTitle,
        decisionLabel: DECISION_LABEL[args.decision],
        notesBlock,
        nextStepLine,
        dashboardUrl: HR_DASH(),
      },
    });
  }

  return { ok: true };
}

export async function hrDecision(args: {
  promotionId: string;
  actorUserId: string;
  decision: Decision;
  notes?: string;
}): Promise<DecisionResult> {
  const existing = await prisma.promotionRequest.findUnique({
    where: { id: args.promotionId },
    include: { employee: true, manager: true },
  });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };

  const claim = await prisma.promotionRequest.updateMany({
    where: { id: args.promotionId, finalStatus: 'PENDING_HR' },
    data: {
      hrDecision: args.decision,
      hrNotes: args.notes ?? null,
      hrDecidedAt: new Date(),
      finalStatus: args.decision,
    },
  });
  if (claim.count === 0) return { ok: false, reason: 'WRONG_STATUS' };

  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'PROMOTION_HR_DECIDED',
    entityType: 'PromotionRequest',
    entityId: args.promotionId,
    metadata: { decision: args.decision },
  });

  const notesBlock = args.notes
    ? `<p><strong>HR notes:</strong> ${escapeHtml(args.notes)}</p>`
    : '';

  await sendEmail({
    to: existing.employee.email,
    template: 'promotion-final-decision',
    data: {
      recipientName: existing.employee.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      dashboardUrl: EMPLOYEE_DASH(),
    },
  });

  await sendEmail({
    to: existing.manager.email,
    template: 'promotion-final-decision',
    data: {
      recipientName: existing.manager.name,
      employeeName: existing.employee.name,
      currentTitle: existing.currentTitle,
      targetTitle: existing.targetTitle,
      decisionLabel: DECISION_LABEL[args.decision],
      notesBlock,
      dashboardUrl: MANAGER_DASH(),
    },
  });

  return { ok: true };
}

export async function listMine(employeeUserId: string) {
  return prisma.promotionRequest.findMany({
    where: { employeeUserId },
    orderBy: { createdAt: 'desc' },
    include: { manager: { select: { id: true, name: true, email: true } } },
  });
}

export async function listForManager(managerUserId: string) {
  return prisma.promotionRequest.findMany({
    where: { managerUserId, finalStatus: 'PENDING_MANAGER' },
    orderBy: { createdAt: 'asc' },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function listForHr() {
  return prisma.promotionRequest.findMany({
    where: { finalStatus: 'PENDING_HR' },
    orderBy: { createdAt: 'asc' },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      manager:  { select: { id: true, name: true, email: true } },
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: Run + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test -- src/lib/services/promotionService.test.ts
git add src/lib/services/promotionService.ts src/lib/services/promotionService.test.ts
git commit -m "feat(promotions): add promotionService with state machine + audits + emails"
```

Test count: 202 + 13 new = 215.

---

## Task 4: Employee submit form + status tracker pages

**Files:**
- Create: `src/app/dashboard/employee/promotions/new/page.tsx`
- Create: `src/app/dashboard/employee/promotions/new/actions.ts`
- Create: `src/app/dashboard/employee/promotions/new/PromotionForm.tsx` (client, with optional supporting-doc upload)
- Create: `src/app/dashboard/employee/promotions/page.tsx` (status tracker)
- Modify: `src/app/dashboard/employee/page.tsx` (un-stub the "Request a promotion" card)

### Step 1: Server action

`src/app/dashboard/employee/promotions/new/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { submitPromotion } from '@/lib/services/promotionService';
import { promotionInputSchema } from '@/lib/validation/promotions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function submitPromotionAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const parsed = promotionInputSchema.safeParse({
    currentTitle:  fd.get('currentTitle'),
    targetTitle:   fd.get('targetTitle'),
    justification: fd.get('justification'),
    supportingDocUrl: fd.get('supportingDocUrl') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const r = await submitPromotion({ employeeUserId: user.id, input: parsed.data });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NO_MANAGER'      ? 'You don\'t have a manager assigned. Ask HR to set one before submitting.' :
        r.reason === 'NO_EMPLOYEE_ROW' ? 'Your account does not have an employee record.' :
                                          'Could not submit this request.',
    };
  }
  revalidatePath('/dashboard/employee/promotions');
  redirect('/dashboard/employee/promotions?submitted=1');
}
```

### Step 2: Client form

`src/app/dashboard/employee/promotions/new/PromotionForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { submitPromotionAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };

export function PromotionForm({ defaultCurrentTitle }: { defaultCurrentTitle: string }) {
  const [state, formAction] = useFormState(submitPromotionAction, {} as FormState);
  const [supportingDocUrl, setSupportingDocUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'supporting-doc');
    fd.append('entityId', 'promotion');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) { setUploadError(json.error ?? 'Upload failed.'); return; }
      setSupportingDocUrl(json.relativePath);
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
        <Label htmlFor="currentTitle">Current title</Label>
        <Input id="currentTitle" name="currentTitle" required defaultValue={defaultCurrentTitle} className="mt-1" />
        {state.fieldErrors?.currentTitle && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.currentTitle[0]}</p>}
      </div>

      <div>
        <Label htmlFor="targetTitle">Target title</Label>
        <Input id="targetTitle" name="targetTitle" required className="mt-1" placeholder="e.g. Senior Engineer" />
        {state.fieldErrors?.targetTitle && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.targetTitle[0]}</p>}
      </div>

      <div>
        <Label htmlFor="justification">Justification</Label>
        <textarea id="justification" name="justification" rows={6} required minLength={20}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What have you done? What impact have you had? Why is this the right next step?" />
        {state.fieldErrors?.justification && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.justification[0]}</p>}
      </div>

      <div>
        <Label htmlFor="supportingDoc">Supporting document (optional, PDF)</Label>
        <input
          id="supportingDoc" type="file" accept=".pdf,application/pdf"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {supportingDocUrl && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="supportingDocUrl" value={supportingDocUrl} />
      </div>

      <Button type="submit" disabled={uploading}>Submit request</Button>
    </form>
  );
}
```

### Step 3: New-promotion page (server)

`src/app/dashboard/employee/promotions/new/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { PromotionForm } from './PromotionForm';

export const metadata = { title: 'Request a promotion · ItsNotTechy Careers' };

export default async function NewPromotionPage() {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { title: true, managerId: true },
  });

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
        <Alert tone="error">Your account is missing an employee record. Please contact HR.</Alert>
      </div>
    );
  }

  if (!employee.managerId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
        <Alert tone="warning">
          You don&apos;t have a manager assigned yet. Ask HR to set one before submitting a request.
        </Alert>
        <Link href="/dashboard/employee/promotions" className="text-sm text-brand-600 hover:underline">
          &larr; Back to my promotions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/employee/promotions" className="text-sm text-brand-600 hover:underline">
        &larr; Back to my promotions
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
      <Card>
        <CardTitle>About this request</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Your manager will review first; if approved, HR will make the final decision.
          You&apos;ll receive an email at each step.
        </p>
        <div className="mt-4">
          <PromotionForm defaultCurrentTitle={employee.title} />
        </div>
      </Card>
    </div>
  );
}
```

### Step 4: Status tracker page

`src/app/dashboard/employee/promotions/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listMine } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';

const STATUS_TONE = {
  PENDING_MANAGER: 'neutral', PENDING_HR: 'blue', APPROVED: 'green', REJECTED: 'red',
} as const;

const STATUS_LABEL = {
  PENDING_MANAGER: 'Awaiting manager', PENDING_HR: 'Awaiting HR',
  APPROVED: 'Approved', REJECTED: 'Rejected',
} as const;

export default async function MyPromotionsPage({
  searchParams,
}: { searchParams: { submitted?: string } }) {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const list = await listMine(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My promotion requests</h1>
        <Link href="/dashboard/employee/promotions/new"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          + New request
        </Link>
      </div>

      {searchParams.submitted === '1' && (
        <Alert tone="success">Request submitted. Your manager has been notified.</Alert>
      )}

      <Card>
        <CardTitle>{list.length} request{list.length === 1 ? '' : 's'}</CardTitle>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No promotion requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {list.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {p.currentTitle} → {p.targetTitle}
                    </div>
                    <div className="text-sm text-slate-500">
                      Manager: {p.manager.name} · Submitted {p.createdAt.toISOString().slice(0, 10)}
                    </div>
                    {p.managerNotes && (
                      <div className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold">Manager notes:</span> {p.managerNotes}
                      </div>
                    )}
                    {p.hrNotes && (
                      <div className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold">HR notes:</span> {p.hrNotes}
                      </div>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[p.finalStatus]}>{STATUS_LABEL[p.finalStatus]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

### Step 5: Un-stub the employee dashboard card

In `src/app/dashboard/employee/page.tsx`, find the existing stale "Request a promotion" Card (with text "Available in Phase 6.") and replace its content with a link to the new tracker:
```tsx
        <Card>
          <CardTitle>Promotions</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/employee/promotions" className="text-brand-600 hover:underline">
              My promotion requests
            </Link>
          </p>
        </Card>
```

And add `import Link from 'next/link';` at the top of the file if not already present.

### Step 6: Build + commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build && npm test
git add src/app/dashboard/employee/
git commit -m "feat(promotions): employee submit form + status tracker pages"
```

---

## Task 5: Manager inbox + decide action

**Files:**
- Create: `src/app/dashboard/manager/promotions/page.tsx`
- Create: `src/app/dashboard/manager/promotions/managerDecisionAction.ts`
- Create: `src/app/dashboard/manager/promotions/ManagerDecisionForm.tsx` (small inline form, one per row)
- Modify: `src/app/dashboard/manager/page.tsx` (replace placeholder Card with link to inbox)

### Step 1: Server action

`src/app/dashboard/manager/promotions/managerDecisionAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { managerDecision } from '@/lib/services/promotionService';
import { decisionInputSchema } from '@/lib/validation/promotions';

export type DecisionFormState = { error?: string; ok?: true };

export async function managerDecisionAction(
  _prev: DecisionFormState | undefined,
  fd: FormData,
): Promise<DecisionFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  const promotionId = String(fd.get('promotionId') ?? '');
  const parsed = decisionInputSchema.safeParse({
    decision: fd.get('decision'),
    notes: (fd.get('notes') as string | null) || undefined,
  });
  if (!parsed.success) return { error: 'Pick Approved or Rejected.' };

  const r = await managerDecision({
    promotionId, actorUserId: user.id,
    decision: parsed.data.decision, notes: parsed.data.notes,
  });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NOT_FOUND'    ? 'Request no longer exists.' :
        r.reason === 'NOT_MANAGER'  ? 'You are not the assigned manager for this request.' :
        r.reason === 'WRONG_STATUS' ? 'This request has already been decided.' :
                                       'Could not record decision.',
    };
  }
  revalidatePath('/dashboard/manager/promotions');
  return { ok: true };
}
```

### Step 2: Decision form (client)

`src/app/dashboard/manager/promotions/ManagerDecisionForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { managerDecisionAction, type DecisionFormState } from './managerDecisionAction';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function ManagerDecisionForm({ promotionId }: { promotionId: string }) {
  const [state, formAction] = useFormState(managerDecisionAction, {} as DecisionFormState);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="promotionId" value={promotionId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Decision recorded.</Alert>}
      <textarea
        name="notes" rows={2} placeholder="Notes (optional)"
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" name="decision" value="APPROVED" variant="primary">Approve</Button>
        <Button type="submit" name="decision" value="REJECTED" variant="danger">Reject</Button>
      </div>
    </form>
  );
}
```

### Step 3: Inbox page

`src/app/dashboard/manager/promotions/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listForManager } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ManagerDecisionForm } from './ManagerDecisionForm';

export const metadata = { title: 'Promotion inbox · ItsNotTechy Careers' };

export default async function ManagerPromotionsPage() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  const list = await listForManager(user.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/manager" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Promotion inbox</h1>
      <p className="text-sm text-slate-500">{list.length} awaiting your decision.</p>

      {list.length === 0 ? (
        <Card><p className="text-sm text-slate-600">No requests awaiting your decision.</p></Card>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.employee.name} — {p.currentTitle} → {p.targetTitle}</CardTitle>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div><dt className="inline font-medium">Submitted: </dt><dd className="inline">{p.createdAt.toISOString().slice(0, 10)}</dd></div>
                <div><dt className="block font-medium">Justification</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.justification}</dd></div>
                {p.supportingDocUrl && (
                  <div>
                    <a className="text-brand-600 hover:underline" href={`/api/files/${p.supportingDocUrl}`} target="_blank" rel="noreferrer">
                      Supporting document
                    </a>
                  </div>
                )}
              </dl>
              <ManagerDecisionForm promotionId={p.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Update Manager dashboard

In `src/app/dashboard/manager/page.tsx`, replace the placeholder "Promotion inbox" card text with a real link:
```tsx
        <Card>
          <CardTitle>Promotion inbox</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/manager/promotions" className="text-brand-600 hover:underline">
              View requests from your direct reports
            </Link>
          </p>
        </Card>
```

Add `import Link from 'next/link';` if not already imported.

### Step 5: Build + commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build && npm test
git add src/app/dashboard/manager/
git commit -m "feat(promotions): manager inbox with approve/reject + notes"
```

---

## Task 6: HR final-decision queue

**Files:**
- Create: `src/app/dashboard/hr/promotions/page.tsx`
- Create: `src/app/dashboard/hr/promotions/hrDecisionAction.ts`
- Create: `src/app/dashboard/hr/promotions/HrDecisionForm.tsx`
- Modify: `src/app/dashboard/hr/page.tsx` (replace placeholder Card with link)

### Step 1: Server action

`src/app/dashboard/hr/promotions/hrDecisionAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { hrDecision } from '@/lib/services/promotionService';
import { decisionInputSchema } from '@/lib/validation/promotions';

export type DecisionFormState = { error?: string; ok?: true };

export async function hrDecisionAction(
  _prev: DecisionFormState | undefined,
  fd: FormData,
): Promise<DecisionFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const promotionId = String(fd.get('promotionId') ?? '');
  const parsed = decisionInputSchema.safeParse({
    decision: fd.get('decision'),
    notes: (fd.get('notes') as string | null) || undefined,
  });
  if (!parsed.success) return { error: 'Pick Approved or Rejected.' };

  const r = await hrDecision({
    promotionId, actorUserId: user.id,
    decision: parsed.data.decision, notes: parsed.data.notes,
  });
  if (!r.ok) {
    return {
      error:
        r.reason === 'NOT_FOUND'    ? 'Request no longer exists.' :
        r.reason === 'WRONG_STATUS' ? 'This request is not awaiting HR.' :
                                       'Could not record decision.',
    };
  }
  revalidatePath('/dashboard/hr/promotions');
  return { ok: true };
}
```

### Step 2: Decision form (client)

`src/app/dashboard/hr/promotions/HrDecisionForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { hrDecisionAction, type DecisionFormState } from './hrDecisionAction';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export function HrDecisionForm({ promotionId }: { promotionId: string }) {
  const [state, formAction] = useFormState(hrDecisionAction, {} as DecisionFormState);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="promotionId" value={promotionId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Final decision recorded.</Alert>}
      <textarea
        name="notes" rows={2} placeholder="Notes (optional)"
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" name="decision" value="APPROVED" variant="primary">Approve</Button>
        <Button type="submit" name="decision" value="REJECTED" variant="danger">Reject</Button>
      </div>
    </form>
  );
}
```

### Step 3: Queue page

`src/app/dashboard/hr/promotions/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listForHr } from '@/lib/services/promotionService';
import { Card, CardTitle } from '@/components/ui/Card';
import { HrDecisionForm } from './HrDecisionForm';

export const metadata = { title: 'Promotion final-decision queue · ItsNotTechy Careers' };

export default async function HrPromotionsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const list = await listForHr();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hr" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">Promotion final decisions</h1>
      <p className="text-sm text-slate-500">{list.length} request{list.length === 1 ? '' : 's'} awaiting HR sign-off.</p>

      {list.length === 0 ? (
        <Card><p className="text-sm text-slate-600">No requests in the HR queue.</p></Card>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.employee.name} — {p.currentTitle} → {p.targetTitle}</CardTitle>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div>
                  <dt className="inline font-medium">Manager: </dt>
                  <dd className="inline">{p.manager.name} ({p.manager.email})</dd>
                </div>
                {p.managerNotes && (
                  <div><dt className="block font-medium">Manager notes</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.managerNotes}</dd></div>
                )}
                <div><dt className="block font-medium">Justification</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{p.justification}</dd></div>
                {p.supportingDocUrl && (
                  <div>
                    <a className="text-brand-600 hover:underline" href={`/api/files/${p.supportingDocUrl}`} target="_blank" rel="noreferrer">
                      Supporting document
                    </a>
                  </div>
                )}
              </dl>
              <HrDecisionForm promotionId={p.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Update HR dashboard

In `src/app/dashboard/hr/page.tsx`, replace the placeholder "Promotions — Phase 6." card with a real link:
```tsx
        <Card>
          <CardTitle>Promotions</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/hr/promotions" className="text-brand-600 hover:underline">
              Final-decision queue
            </Link>
          </p>
        </Card>
```

Add `import Link from 'next/link';` if not already imported.

### Step 5: Build + commit

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build && npm test
git add src/app/dashboard/hr/
git commit -m "feat(promotions): HR final-decision queue"
```

---

## Task 7: Phase 6 sweep + final review + tag + merge

- [ ] **Step 1: Full sweep**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && \
  npm test && \
  npx tsc --noEmit && \
  npm run lint && \
  npm run build
```

All four must be green. Tests should land around 215.

- [ ] **Step 2: Dispatch final opus code review**

Scope: commits from `phase-5-complete` to HEAD of `phase-6-promotions`. Spec: §8.4 and capability matrix rows on promotions (§5).

- [ ] **Step 3: Fix anything substantive** (separate fix commits).

- [ ] **Step 4: Tag + ff-merge to main**

```bash
git tag phase-6-complete
git checkout main
git merge --ff-only phase-6-promotions
git checkout phase-6-promotions
```

---

## End-of-plan state

- Full promotion lifecycle: submit → manager approve/reject (with notes) → HR final decision → 3 emails fire at each step
- 3 new templates registered
- Employee tracker `/dashboard/employee/promotions`, submit form `/promotions/new`, manager inbox `/dashboard/manager/promotions`, HR queue `/dashboard/hr/promotions`
- ~215 tests passing

## Out of scope (defer to v2)

- Editing an in-flight request (delete-and-resubmit is the workaround)
- Withdraw-by-employee
- HR re-routing to a different manager
- Promotion calendar / window enforcement
- Bulk decision actions
