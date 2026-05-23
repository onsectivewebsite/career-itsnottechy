# Phase 11 — Reusable HR Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let SUPER_ADMIN curate reusable email templates and let HR users pick one, edit the interpolated subject/body, and send it to a candidate — either from an application detail page or from a standalone compose page.

**Architecture:** A new `EmailTemplate` table plus a small `emailTemplateService` for CRUD. A `buildEmailVars` helper and a `sendCustomEmail` function that reuses the existing transport, layout, and `EmailLog`. Two send forms (application-scoped on the HR app-detail page; standalone at `/dashboard/hr/compose`) both built on the existing `RichTextEditor`.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Zod, TipTap (already installed), Vitest.

**Conventions for every task:**
- Node/npm/npx come from nvm — prefix EVERY `npm`/`npx` command with `PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.
- `npm test` runs the full Vitest suite; `npx vitest run <path>` runs one file.
- DB tests target `careers_test` and call `resetDb()` in `beforeEach`.
- Commit after every task with the message in its final step.
- Spec: `docs/superpowers/specs/2026-05-22-phase-11-hr-email-templates-design.md`.

---

## Task 1: Prisma schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/test/db.ts`

- [ ] **Step 1: Add the model and relation**

In `prisma/schema.prisma`:

1. Add a new relation field to the `User` model relation block:
```prisma
  emailTemplatesCreated  EmailTemplate[]      @relation("EmailTemplatesCreated")
```

2. Add the new model after the `EmailLog` model:
```prisma
model EmailTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  subject     String
  body        String   @db.Text
  createdById String?
  createdBy   User?    @relation("EmailTemplatesCreated", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_email_templates`
Expected: a new migration folder is created and applied; `prisma generate` runs. No errors.

- [ ] **Step 3: Update the test-DB reset helper**

In `src/lib/test/db.ts`, add `'EmailTemplate',` to the `tables` array on the line immediately **before** `'User',`:
```ts
    'EmailTemplate',
    'User',
```

- [ ] **Step 4: Apply the migration to the test database**

Run: `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`
Expected: "All migrations have been successfully applied." (Read `$TEST_DATABASE_URL` from `.env` if not set in the shell.)

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/test/db.ts
git commit -m "feat(email-templates): add EmailTemplate model"
```

---

## Task 2: Validation schema

**Files:**
- Create: `src/lib/validation/emailTemplates.ts`
- Test: `src/lib/validation/emailTemplates.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/validation/emailTemplates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emailTemplateInputSchema } from './emailTemplates';

describe('emailTemplateInputSchema', () => {
  const ok = { name: 'Rejection', subject: 'About your application', body: '<p>Hi {{candidateName}}</p>' };

  it('accepts a well-formed template', () => {
    expect(emailTemplateInputSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, name: '' }).success).toBe(false);
  });

  it('rejects empty subject', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, subject: '' }).success).toBe(false);
  });

  it('rejects body over the max size', () => {
    expect(emailTemplateInputSchema.safeParse({ ...ok, body: 'x'.repeat(50001) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/emailTemplates.test.ts`
Expected: FAIL — `./emailTemplates` does not exist.

- [ ] **Step 3: Implement the schema**

`src/lib/validation/emailTemplates.ts`:
```ts
import { z } from 'zod';

export const emailTemplateInputSchema = z.object({
  name:    z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  body:    z.string().max(50000),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateInputSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/emailTemplates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/emailTemplates.ts src/lib/validation/emailTemplates.test.ts
git commit -m "feat(email-templates): add validation schema"
```

---

## Task 3: `emailTemplateService`

**Files:**
- Create: `src/lib/services/emailTemplateService.ts`
- Test: `src/lib/services/emailTemplateService.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/services/emailTemplateService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  createTemplate, updateTemplate, deleteTemplate, listTemplates, getTemplate,
} from './emailTemplateService';

async function makeAdmin() {
  return prisma.user.create({ data: { email: 'a@x.com', name: 'Admin', role: 'SUPER_ADMIN' } });
}

const ok = { name: 'Rejection', subject: 'About your application', body: '<p>Hi</p>' };

describe('createTemplate', () => {
  beforeEach(() => resetDb());

  it('creates a template and writes an audit row', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = await prisma.emailTemplate.findUnique({ where: { id: r.id } });
    expect(t?.name).toBe('Rejection');
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'EMAIL_TEMPLATE_CREATED')).toBe(true);
  });

  it('sanitises the body on save', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({
      input: { ...ok, body: '<p onclick="evil()">hi</p><script>alert(1)</script>' },
      actorUserId: admin.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = await prisma.emailTemplate.findUnique({ where: { id: r.id } });
    expect(t?.body).not.toContain('<script>');
    expect(t?.body).not.toContain('onclick');
    expect(t?.body).toContain('hi');
  });

  it('returns NAME_TAKEN on duplicate name', async () => {
    const admin = await makeAdmin();
    const first = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(first.ok).toBe(true);
    const dup = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(dup).toEqual({ ok: false, reason: 'NAME_TAKEN' });
  });

  it('returns INVALID on bad input', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({ input: { ...ok, name: '' }, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'INVALID' });
  });
});

describe('updateTemplate / deleteTemplate / listTemplates / getTemplate', () => {
  beforeEach(() => resetDb());

  it('updates an existing template', async () => {
    const admin = await makeAdmin();
    const c = await createTemplate({ input: ok, actorUserId: admin.id });
    if (!c.ok) throw new Error();
    const r = await updateTemplate({
      id: c.id, input: { ...ok, subject: 'Updated' }, actorUserId: admin.id,
    });
    expect(r.ok).toBe(true);
    const t = await prisma.emailTemplate.findUnique({ where: { id: c.id } });
    expect(t?.subject).toBe('Updated');
  });

  it('updateTemplate returns NOT_FOUND for missing id', async () => {
    const admin = await makeAdmin();
    const r = await updateTemplate({ id: 'nope', input: ok, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('deletes a template', async () => {
    const admin = await makeAdmin();
    const c = await createTemplate({ input: ok, actorUserId: admin.id });
    if (!c.ok) throw new Error();
    expect((await deleteTemplate({ id: c.id, actorUserId: admin.id })).ok).toBe(true);
    expect(await prisma.emailTemplate.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it('listTemplates returns all, newest-updated first; getTemplate returns one', async () => {
    const admin = await makeAdmin();
    await createTemplate({ input: { ...ok, name: 'A' }, actorUserId: admin.id });
    const b = await createTemplate({ input: { ...ok, name: 'B' }, actorUserId: admin.id });
    if (!b.ok) throw new Error();
    const list = await listTemplates();
    expect(list).toHaveLength(2);
    const one = await getTemplate(b.id);
    expect(one?.name).toBe('B');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/emailTemplateService.test.ts`
Expected: FAIL — `./emailTemplateService` does not exist.

- [ ] **Step 3: Implement the service**

`src/lib/services/emailTemplateService.ts`:
```ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sanitizeRichHtml } from '@/lib/richText';
import { emailTemplateInputSchema, type EmailTemplateInput } from '@/lib/validation/emailTemplates';

export type CreateResult = { ok: true; id: string } | { ok: false; reason: 'INVALID' | 'NAME_TAKEN' };
export type UpdateResult = { ok: true } | { ok: false; reason: 'INVALID' | 'NAME_TAKEN' | 'NOT_FOUND' };
export type DeleteResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

export async function createTemplate(args: {
  input: EmailTemplateInput;
  actorUserId: string;
}): Promise<CreateResult> {
  const parsed = emailTemplateInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  try {
    const t = await prisma.emailTemplate.create({
      data: {
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: sanitizeRichHtml(parsed.data.body),
        createdById: args.actorUserId,
      },
    });
    await recordAudit({
      actorUserId: args.actorUserId,
      action: 'EMAIL_TEMPLATE_CREATED',
      entityType: 'EmailTemplate',
      entityId: t.id,
      metadata: { name: t.name },
    });
    return { ok: true, id: t.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'NAME_TAKEN' };
    }
    throw err;
  }
}

export async function updateTemplate(args: {
  id: string;
  input: EmailTemplateInput;
  actorUserId: string;
}): Promise<UpdateResult> {
  const parsed = emailTemplateInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const existing = await prisma.emailTemplate.findUnique({ where: { id: args.id } });
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };

  try {
    await prisma.emailTemplate.update({
      where: { id: args.id },
      data: {
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: sanitizeRichHtml(parsed.data.body),
      },
    });
    await recordAudit({
      actorUserId: args.actorUserId,
      action: 'EMAIL_TEMPLATE_UPDATED',
      entityType: 'EmailTemplate',
      entityId: args.id,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'NAME_TAKEN' };
    }
    throw err;
  }
}

export async function deleteTemplate(args: {
  id: string;
  actorUserId: string;
}): Promise<DeleteResult> {
  const r = await prisma.emailTemplate.deleteMany({ where: { id: args.id } });
  if (r.count !== 1) return { ok: false, reason: 'NOT_FOUND' };
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'EMAIL_TEMPLATE_DELETED',
    entityType: 'EmailTemplate',
    entityId: args.id,
  });
  return { ok: true };
}

export async function listTemplates() {
  return prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function getTemplate(id: string) {
  return prisma.emailTemplate.findUnique({ where: { id } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/emailTemplateService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/emailTemplateService.ts src/lib/services/emailTemplateService.test.ts
git commit -m "feat(email-templates): add emailTemplateService"
```

---

## Task 4: Admin list page + create page + create action

**Files:**
- Create: `src/app/dashboard/admin/email-templates/page.tsx`
- Create: `src/app/dashboard/admin/email-templates/EmailTemplateForm.tsx`
- Create: `src/app/dashboard/admin/email-templates/actions.ts`
- Create: `src/app/dashboard/admin/email-templates/new/page.tsx`

- [ ] **Step 1: Create the actions file (create only for this task)**

`src/app/dashboard/admin/email-templates/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import {
  createTemplate, updateTemplate, deleteTemplate,
} from '@/lib/services/emailTemplateService';
import type { EmailTemplateInput } from '@/lib/validation/emailTemplates';

type FormState = { error?: string; ok?: true };

function parseInput(fd: FormData): EmailTemplateInput {
  return {
    name:    String(fd.get('name') ?? ''),
    subject: String(fd.get('subject') ?? ''),
    body:    String(fd.get('body') ?? ''),
  };
}

export async function createTemplateAction(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const r = await createTemplate({ input: parseInput(fd), actorUserId: user.id });
  if (!r.ok) {
    return { error: r.reason === 'NAME_TAKEN' ? 'A template with that name already exists.' : 'Some fields are invalid.' };
  }
  revalidatePath('/dashboard/admin/email-templates');
  redirect(`/dashboard/admin/email-templates/${r.id}`);
}

export async function updateTemplateAction(id: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const r = await updateTemplate({ id, input: parseInput(fd), actorUserId: user.id });
  if (!r.ok) {
    const msg =
      r.reason === 'NAME_TAKEN' ? 'A template with that name already exists.' :
      r.reason === 'NOT_FOUND'  ? 'Template not found.' :
                                  'Some fields are invalid.';
    return { error: msg };
  }
  revalidatePath('/dashboard/admin/email-templates');
  revalidatePath(`/dashboard/admin/email-templates/${id}`);
  return { ok: true };
}

export async function deleteTemplateAction(id: string): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  await deleteTemplate({ id, actorUserId: user.id });
  revalidatePath('/dashboard/admin/email-templates');
  redirect('/dashboard/admin/email-templates');
}
```

- [ ] **Step 2: Create the form component**

`src/app/dashboard/admin/email-templates/EmailTemplateForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

type FormState = { error?: string; ok?: true };

export function EmailTemplateForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults: { name: string; subject: string; body: string };
  action: (prev: FormState | undefined, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {} as FormState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required className="mt-1" />
        <p className="mt-1 text-xs text-slate-500">Shown in the picker on the send form. Must be unique.</p>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" defaultValue={defaults.subject} required className="mt-1" />
        <p className="mt-1 text-xs text-slate-500">
          Supports variables: <code>{'{{candidateName}}'}</code>, <code>{'{{jobTitle}}'}</code>, <code>{'{{stageLabel}}'}</code>.
        </p>
      </div>

      <div>
        <Label>Body</Label>
        <div className="mt-1">
          <RichTextEditor name="body" initialHtml={defaults.body} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Same variables work in the body. <code>{'{{dashboardUrl}}'}</code> is also available.
        </p>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the list page**

`src/app/dashboard/admin/email-templates/page.tsx`:
```tsx
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listTemplates } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function EmailTemplatesPage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const templates = await listTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Email templates</h1>
        <Link href="/dashboard/admin/email-templates/new"><Button>+ New template</Button></Link>
      </div>

      <Card>
        <CardTitle>All templates</CardTitle>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No templates yet. Create one to get started.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/admin/email-templates/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {t.name}
                  </Link>
                  <div className="text-sm text-slate-500">{t.subject}</div>
                </div>
                <div className="text-xs text-slate-500">Updated {t.updatedAt.toISOString().slice(0, 10)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create the new-template page**

`src/app/dashboard/admin/email-templates/new/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmailTemplateForm } from '../EmailTemplateForm';
import { createTemplateAction } from '../actions';

export default async function NewEmailTemplatePage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New email template</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <EmailTemplateForm
            defaults={{ name: '', subject: '', body: '' }}
            action={createTemplateAction}
            submitLabel="Create template"
          />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/admin/email-templates
git commit -m "feat(email-templates): admin list and create-template UI"
```

---

## Task 5: Admin edit page + update/delete actions

**Files:**
- Create: `src/app/dashboard/admin/email-templates/[id]/page.tsx`
- Modify: nothing else (actions for update and delete already exist from Task 4).

- [ ] **Step 1: Create the edit page**

`src/app/dashboard/admin/email-templates/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { getTemplate } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmailTemplateForm } from '../EmailTemplateForm';
import { updateTemplateAction, deleteTemplateAction } from '../actions';

export default async function EditEmailTemplatePage({ params }: { params: { id: string } }) {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const template = await getTemplate(params.id);
  if (!template) notFound();

  const boundUpdate = updateTemplateAction.bind(null, params.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/email-templates" className="text-sm text-brand-600 hover:underline">&larr; All templates</Link>
      <h1 className="text-2xl font-bold text-slate-900">{template.name}</h1>

      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <EmailTemplateForm
            defaults={{ name: template.name, subject: template.subject, body: template.body }}
            action={boundUpdate}
            submitLabel="Save changes"
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Danger zone</CardTitle>
        <form action={deleteTemplateAction.bind(null, params.id)} className="mt-3">
          <p className="text-sm text-slate-600">
            Deleting this template can&apos;t be undone. Existing emails already sent are unaffected.
          </p>
          <div className="mt-3">
            <Button type="submit" variant="danger">Delete template</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/admin/email-templates/[id]/page.tsx
git commit -m "feat(email-templates): admin edit and delete page"
```

---

## Task 6: `buildEmailVars` and `sendCustomEmail`

**Files:**
- Create: `src/lib/email/vars.ts`
- Create: `src/lib/email/sendCustom.ts`
- Test: `src/lib/email/vars.test.ts`
- Test: `src/lib/email/sendCustom.test.ts`

- [ ] **Step 1: Write failing tests for `buildEmailVars`**

`src/lib/email/vars.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildEmailVars } from './vars';

describe('buildEmailVars', () => {
  it('resolves all fields from an application', () => {
    process.env.APP_URL = 'https://example.test';
    const vars = buildEmailVars({
      kind: 'application',
      candidate: { name: 'Alice' },
      job: { title: 'Designer' },
      stageLabel: 'Interview',
    });
    expect(vars).toEqual({
      candidateName: 'Alice',
      jobTitle: 'Designer',
      stageLabel: 'Interview',
      dashboardUrl: 'https://example.test/dashboard/candidate',
    });
  });

  it('returns empty strings for unavailable tokens in standalone mode', () => {
    process.env.APP_URL = 'https://example.test';
    expect(buildEmailVars({ kind: 'standalone', candidate: { name: 'Bob' } })).toEqual({
      candidateName: 'Bob',
      jobTitle: '',
      stageLabel: '',
      dashboardUrl: 'https://example.test/dashboard/candidate',
    });
  });

  it('uses the picked job title in standalone mode when provided', () => {
    expect(
      buildEmailVars({ kind: 'standalone', candidate: { name: 'Bob' }, job: { title: 'Engineer' } })
        .jobTitle,
    ).toBe('Engineer');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email/vars.test.ts`
Expected: FAIL — `./vars` does not exist.

- [ ] **Step 3: Implement `buildEmailVars`**

`src/lib/email/vars.ts`:
```ts
export type EmailVars = {
  candidateName: string;
  jobTitle: string;
  stageLabel: string;
  dashboardUrl: string;
};

export type BuildVarsInput =
  | {
      kind: 'application';
      candidate: { name: string };
      job: { title: string };
      stageLabel: string;
    }
  | {
      kind: 'standalone';
      candidate: { name: string };
      job?: { title: string };
    };

/** Returns the fixed-set variables used by HR email templates. */
export function buildEmailVars(input: BuildVarsInput): EmailVars {
  const dashboardUrl = `${process.env.APP_URL ?? ''}/dashboard/candidate`;
  if (input.kind === 'application') {
    return {
      candidateName: input.candidate.name,
      jobTitle: input.job.title,
      stageLabel: input.stageLabel,
      dashboardUrl,
    };
  }
  return {
    candidateName: input.candidate.name,
    jobTitle: input.job?.title ?? '',
    stageLabel: '',
    dashboardUrl,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email/vars.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for `sendCustomEmail`**

`src/lib/email/sendCustom.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { sendCustomEmail } from './sendCustom';

describe('sendCustomEmail', () => {
  beforeEach(() => resetDb());

  it('writes an EmailLog row with template=hr-custom and the sanitised body', async () => {
    await sendCustomEmail({
      to: 'c@x.com',
      subject: 'Hello',
      html: '<p>Hi <strong>Alice</strong></p><script>alert(1)</script>',
    });
    const log = await prisma.emailLog.findFirst({ where: { template: 'hr-custom' } });
    expect(log).not.toBeNull();
    expect(log?.toEmail).toBe('c@x.com');
    expect(log?.subject).toBe('Hello');
    expect(log?.status).toBe('SENT');
  });

  it('stores the source template id in the payload when provided', async () => {
    await sendCustomEmail({
      to: 'c@x.com', subject: 'X', html: '<p>x</p>', sourceTemplateId: 'tmpl-1',
    });
    const log = await prisma.emailLog.findFirst({ where: { template: 'hr-custom' } });
    expect((log?.payload as { sourceTemplateId?: string } | null)?.sourceTemplateId).toBe('tmpl-1');
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email/sendCustom.test.ts`
Expected: FAIL — `./sendCustom` does not exist.

- [ ] **Step 7: Implement `sendCustomEmail`**

`src/lib/email/sendCustom.ts`:
```ts
import { prisma } from '@/lib/prisma';
import { getTransport } from './transport';
import { wrapInLayout } from './render';
import { getSettings } from '@/lib/services/systemSettings';
import { sanitizeRichHtml } from '@/lib/richText';

async function fromAddress(): Promise<string> {
  const s = await getSettings();
  const name = process.env.SMTP_FROM_NAME ?? s.defaultSenderName;
  const email = process.env.SMTP_FROM_EMAIL ?? 'info@itsnottechy.com';
  return `${name} <${email}>`;
}

export type SendCustomEmailArgs = {
  to: string;
  subject: string;
  /** HTML body; will be sanitised and wrapped in the brand layout. */
  html: string;
  /** Optional id of the EmailTemplate the body was based on. Recorded in the EmailLog payload. */
  sourceTemplateId?: string;
};

/** Send a one-off HR-authored email. Never throws — mirrors the sendEmail contract. */
export async function sendCustomEmail(args: SendCustomEmailArgs): Promise<void> {
  const safeBody = sanitizeRichHtml(args.html);
  const fullHtml = wrapInLayout(safeBody, { previewText: args.subject });

  let logId: string | null = null;
  try {
    const log = await prisma.emailLog.create({
      data: {
        toEmail: args.to,
        subject: args.subject,
        template: 'hr-custom',
        payload: { sourceTemplateId: args.sourceTemplateId ?? null },
        status: 'QUEUED',
      },
    });
    logId = log.id;

    await getTransport().sendMail({
      from: await fromAddress(),
      to: args.to,
      subject: args.subject,
      html: fullHtml,
    });

    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      try {
        await prisma.emailLog.update({
          where: { id: logId },
          data: { status: 'FAILED', error: message },
        });
      } catch {
        // intentional: never throw from sendCustomEmail
      }
    }
    // eslint-disable-next-line no-console
    console.error(`[email] custom send failed (to=${args.to}): ${message}`);
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email/sendCustom.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/email/vars.ts src/lib/email/vars.test.ts src/lib/email/sendCustom.ts src/lib/email/sendCustom.test.ts
git commit -m "feat(email-templates): add buildEmailVars and sendCustomEmail"
```

---

## Task 7: Application-detail "Send email" panel

**Files:**
- Create: `src/app/dashboard/hr/applications/[id]/SendEmailForm.tsx`
- Create: `src/app/dashboard/hr/applications/[id]/sendEmailAction.ts`
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx`

- [ ] **Step 1: Create the server action**

`src/app/dashboard/hr/applications/[id]/sendEmailAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { sendCustomEmail } from '@/lib/email/sendCustom';
import { recordAudit } from '@/lib/audit';

type FormState = { error?: string; ok?: true };

export async function sendCustomEmailAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const subject = String(fd.get('subject') ?? '').trim();
  const body    = String(fd.get('body')    ?? '');
  const sourceTemplateId = String(fd.get('sourceTemplateId') ?? '').trim() || undefined;

  if (!subject) return { error: 'Subject is required.' };
  if (!body)    return { error: 'Body is required.' };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: { select: { name: true, email: true } } },
  });
  if (!app) return { error: 'Application not found.' };

  await sendCustomEmail({
    to: app.candidate.email,
    subject,
    html: body,
    sourceTemplateId,
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'HR_EMAIL_SENT',
    entityType: 'Application',
    entityId: applicationId,
    metadata: { subject, sourceTemplateId: sourceTemplateId ?? null },
  });

  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Create the form component**

`src/app/dashboard/hr/applications/[id]/SendEmailForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { interpolate } from '@/lib/email/render';
import { sendCustomEmailAction } from './sendEmailAction';

type FormState = { error?: string; ok?: true };

export type TemplateOption = { id: string; name: string; subject: string; body: string };
export type EmailVars = {
  candidateName: string;
  jobTitle: string;
  stageLabel: string;
  dashboardUrl: string;
};

export function SendEmailForm({
  applicationId,
  templates,
  vars,
}: {
  applicationId: string;
  templates: TemplateOption[];
  vars: EmailVars;
}) {
  const bound = sendCustomEmailAction.bind(null, applicationId);
  const [state, formAction] = useFormState(bound, {} as FormState);

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = templates.find((t) => t.id === selectedId);
  const initialSubject = selected ? interpolate(selected.subject, vars as unknown as Record<string, string>) : '';
  const initialBody    = selected ? interpolate(selected.body,    vars as unknown as Record<string, string>) : '';
  const [subject, setSubject] = useState(initialSubject);

  function onTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    setSubject(t ? interpolate(t.subject, vars as unknown as Record<string, string>) : '');
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Email sent.</Alert>}

      <div>
        <Label htmlFor="template">Template</Label>
        <select
          id="template"
          value={selectedId}
          onChange={onTemplateChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Blank —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="hidden" name="sourceTemplateId" value={selectedId} />
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label>Body</Label>
        {/* Keyed by selected template id so picking a new template re-mounts
            the editor with the interpolated body. */}
        <div className="mt-1">
          <RichTextEditor key={selectedId || 'blank'} name="body" initialHtml={initialBody} />
        </div>
      </div>

      <Button type="submit">Send email</Button>
    </form>
  );
}
```

- [ ] **Step 3: Wire the panel into the HR application detail page**

In `src/app/dashboard/hr/applications/[id]/page.tsx`:

1. Add to the imports:
```tsx
import { listTemplates } from '@/lib/services/emailTemplateService';
import { buildEmailVars } from '@/lib/email/vars';
import { STAGE_LABEL } from '@/lib/ats/stages';
import { SendEmailForm } from './SendEmailForm';
```
(`STAGE_LABEL` is already imported in this file — skip if it is.)

2. After the `const documents = await listApplicationDocuments(params.id);` line (added in Phase 8), add:
```tsx
  const emailTemplates = await listTemplates();
  const emailVars = buildEmailVars({
    kind: 'application',
    candidate: { name: app.candidate.name },
    job: { title: app.job.title },
    stageLabel: STAGE_LABEL[app.stage],
  });
```

3. Add this `<Card>` block inside the returned JSX, after the Documents `<Card>` (the one rendering application documents) and before any closing wrapper:
```tsx
      <Card>
        <CardTitle>Send email</CardTitle>
        <p className="mt-1 text-sm text-slate-600">
          Pick a template, edit if needed, and send to {app.candidate.email}.
        </p>
        <div className="mt-4">
          <SendEmailForm
            applicationId={params.id}
            templates={emailTemplates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
            vars={emailVars}
          />
        </div>
      </Card>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/hr/applications/[id]/SendEmailForm.tsx src/app/dashboard/hr/applications/[id]/sendEmailAction.ts src/app/dashboard/hr/applications/[id]/page.tsx
git commit -m "feat(email-templates): HR send-email panel on application detail"
```

---

## Task 8: Standalone compose page

**Files:**
- Create: `src/app/dashboard/hr/compose/page.tsx`
- Create: `src/app/dashboard/hr/compose/ComposeForm.tsx`
- Create: `src/app/dashboard/hr/compose/actions.ts`

- [ ] **Step 1: Create the server action**

`src/app/dashboard/hr/compose/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { sendCustomEmail } from '@/lib/email/sendCustom';
import { recordAudit } from '@/lib/audit';

type FormState = { error?: string; ok?: true };

export async function sendCustomEmailComposeAction(
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const candidateUserId  = String(fd.get('candidateUserId') ?? '').trim();
  const subject          = String(fd.get('subject') ?? '').trim();
  const body             = String(fd.get('body') ?? '');
  const sourceTemplateId = String(fd.get('sourceTemplateId') ?? '').trim() || undefined;

  if (!candidateUserId) return { error: 'Pick a candidate.' };
  if (!subject)         return { error: 'Subject is required.' };
  if (!body)            return { error: 'Body is required.' };

  const candidate = await prisma.user.findFirst({
    where: { id: candidateUserId, role: 'CANDIDATE' },
    select: { id: true, name: true, email: true },
  });
  if (!candidate) return { error: 'Candidate not found.' };

  await sendCustomEmail({
    to: candidate.email,
    subject,
    html: body,
    sourceTemplateId,
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'HR_EMAIL_SENT',
    entityType: 'User',
    entityId: candidate.id,
    metadata: { subject, sourceTemplateId: sourceTemplateId ?? null },
  });

  revalidatePath('/dashboard/hr/compose');
  return { ok: true };
}
```

- [ ] **Step 2: Create the form component**

`src/app/dashboard/hr/compose/ComposeForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { interpolate } from '@/lib/email/render';
import { sendCustomEmailComposeAction } from './actions';

type FormState = { error?: string; ok?: true };

export type CandidateOption = { id: string; name: string; email: string };
export type JobOption       = { id: string; title: string };
export type TemplateOption  = { id: string; name: string; subject: string; body: string };

export function ComposeForm({
  candidates,
  jobs,
  templates,
  appUrl,
}: {
  candidates: CandidateOption[];
  jobs: JobOption[];
  templates: TemplateOption[];
  appUrl: string;
}) {
  const [state, formAction] = useFormState(sendCustomEmailComposeAction, {} as FormState);

  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId]             = useState('');
  const [selectedId, setSelectedId]   = useState('');

  const vars = useMemo(() => {
    const c = candidates.find((x) => x.id === candidateId);
    const j = jobs.find((x) => x.id === jobId);
    return {
      candidateName: c?.name ?? '',
      jobTitle:      j?.title ?? '',
      stageLabel:    '',
      dashboardUrl:  `${appUrl}/dashboard/candidate`,
    };
  }, [candidateId, jobId, candidates, jobs, appUrl]);

  const selected = templates.find((t) => t.id === selectedId);
  const interpolatedSubject = selected ? interpolate(selected.subject, vars) : '';
  const interpolatedBody    = selected ? interpolate(selected.body,    vars) : '';

  const [subject, setSubject] = useState('');

  function onTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    setSubject(t ? interpolate(t.subject, vars) : '');
  }

  // When the candidate/job changes after a template is chosen, re-fill the subject too.
  function onCandidateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCandidateId(e.target.value);
    if (selected) setSubject(interpolate(selected.subject, {
      ...vars,
      candidateName: candidates.find((x) => x.id === e.target.value)?.name ?? '',
    }));
  }
  function onJobChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setJobId(e.target.value);
    if (selected) setSubject(interpolate(selected.subject, {
      ...vars,
      jobTitle: jobs.find((x) => x.id === e.target.value)?.title ?? '',
    }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok  && <Alert tone="success">Email sent.</Alert>}

      <div>
        <Label htmlFor="candidateUserId">Candidate</Label>
        <select
          id="candidateUserId"
          name="candidateUserId"
          value={candidateId}
          onChange={onCandidateChange}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Pick a candidate —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="jobId">Job (optional)</Label>
        <select
          id="jobId"
          value={jobId}
          onChange={onJobChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="template">Template</Label>
        <select
          id="template"
          value={selectedId}
          onChange={onTemplateChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Blank —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="hidden" name="sourceTemplateId" value={selectedId} />
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label>Body</Label>
        <div className="mt-1">
          <RichTextEditor
            key={`${selectedId}-${candidateId}-${jobId}` || 'blank'}
            name="body"
            initialHtml={interpolatedBody}
          />
        </div>
      </div>

      <Button type="submit">Send email</Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the page**

`src/app/dashboard/hr/compose/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listJobsForHr } from '@/lib/services/jobService';
import { listTemplates } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ComposeForm } from './ComposeForm';

export default async function ComposePage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const [candidates, jobs, templates] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CANDIDATE', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    listJobsForHr(),
    listTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Compose email</h1>
      <Card>
        <CardTitle>To a candidate</CardTitle>
        <p className="mt-1 text-sm text-slate-600">Pick a candidate, optionally a role, then a template.</p>
        <div className="mt-4">
          <ComposeForm
            candidates={candidates}
            jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
            templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
            appUrl={process.env.APP_URL ?? ''}
          />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/hr/compose
git commit -m "feat(email-templates): standalone compose page"
```

---

# Final verification

After Task 8:

- [ ] `npm test` — all green
- [ ] `npm run build` — succeeds
- [ ] Manual smoke test: as a SUPER_ADMIN, create a template "Rejection" with `{{candidateName}}` and `{{jobTitle}}` in subject and body; as an HR_MANAGER, open an application detail page, pick the "Rejection" template, confirm the subject and body are pre-filled with the candidate's name and the job title, send, and confirm an `EmailLog` row with `template='hr-custom'` is written; visit `/dashboard/hr/compose`, pick a candidate without an application, send a blank email; confirm only `SUPER_ADMIN` can reach `/dashboard/admin/email-templates` (HR redirected/403).

Then deploy per the runbook: rsync, `npm ci`, `npx prisma migrate deploy` (applies `add_email_templates`), `npm run build`, `pm2 restart`.
