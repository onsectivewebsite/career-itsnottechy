# Phase 11 — Reusable HR Email Templates — Design Spec

**Date:** 2026-05-22
**Status:** Approved for planning
**Builds on:** Phase 10 (saved jobs + alerts), merged to `main` and deployed.
**Roadmap item:** P0 — "Reusable HR email templates" (`docs/superpowers/roadmap.md`).

## 1. Overview

Let HR send custom emails to candidates using saved templates instead of writing each one from scratch.

- An admin curates a set of reusable templates (e.g. "Rejection — polite", "Interview invite", "Offer hold").
- An HR user opens an application (or the standalone compose page), picks a template, sees the subject and body pre-filled with the candidate's name / job title / current stage, edits if needed, and sends.

One new database table; one migration. The send path reuses the existing transport, layout, and `EmailLog`.

### Success criteria

- `SUPER_ADMIN` can create, edit, and delete email templates with a WYSIWYG body editor at `/dashboard/admin/email-templates`.
- An `HR_MANAGER` (or `SUPER_ADMIN`) on the application detail page can pick a template, see the interpolated subject and body, edit either, and send.
- Standalone compose at `/dashboard/hr/compose` lets the same roles pick any candidate (and optionally a job) and send.
- Every send produces an `EmailLog` row and an `HR_EMAIL_SENT` audit row; sanitised HTML is what gets delivered.
- `npm test` green; `npm run build` succeeds.

### Out of scope

- Editing the existing system templates (`application-received`, `interview-scheduled`, etc.) — only the new HR-facing templates are stored in the DB.
- Per-template attachments, scheduled/queued sends, A/B variations, opt-out tokens — none of these are in scope.
- Per-template RBAC — every saved template is usable by every HR user.
- An "Emails sent" history panel on the application detail — relies on the existing `EmailLog` for audit; UI surface can come later.

## 2. Data model

One new model:

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

`User` gains `emailTemplatesCreated EmailTemplate[] @relation("EmailTemplatesCreated")`. Migration name: `add_email_templates`. `EmailTemplate` is added to the `resetDb` truncation list.

`body` stores sanitised HTML (the same allowlist used for job descriptions). `name` is unique to keep the picker list clean.

## 3. Variables

A fixed, small set, substituted in subject and body via the existing `interpolate()` helper from `src/lib/email/render.ts`. `interpolate` HTML-escapes `{{var}}` values by default — names safely render as text.

| Token | Source (application-scoped) | Source (standalone) |
|---|---|---|
| `{{candidateName}}` | `application.candidate.name` | the candidate picked in the form |
| `{{jobTitle}}` | `application.job.title` | the job picked, or empty string |
| `{{stageLabel}}` | `STAGE_LABEL[application.stage]` | empty string |
| `{{dashboardUrl}}` | `${APP_URL}/dashboard/candidate` | `${APP_URL}/dashboard/candidate` |

A `buildEmailVars` helper in `src/lib/email/vars.ts` returns the resolved record from either an application or a `{ candidate, job? }` pair.

Unknown tokens are passed through unchanged (the existing `interpolate` behaviour) — minor and fine.

## 4. Admin: manage templates

`SUPER_ADMIN` only. New routes under `src/app/dashboard/admin/email-templates/`:

- `page.tsx` — list templates with name, last-updated, and create-new button.
- `new/page.tsx` — create form (name, subject, body) using `<RichTextEditor>` for body.
- `[id]/page.tsx` — edit form (same shape) + delete.

Server actions in `actions.ts`: `createTemplateAction`, `updateTemplateAction`, `deleteTemplateAction`. All `requireRole(SUPER_ADMIN)`.

Service `src/lib/services/emailTemplateService.ts`:

- `createTemplate({ input, actorUserId })` — Zod validates name (1–120 chars), subject (1–200 chars), body (max 50,000 chars); sanitises body with `sanitizeRichHtml` before insert; audits `EMAIL_TEMPLATE_CREATED`. Returns `{ ok: true, id }` or `{ ok: false, reason: 'INVALID' | 'NAME_TAKEN' }`.
- `updateTemplate({ id, input, actorUserId })` — same validation + sanitisation; audits `EMAIL_TEMPLATE_UPDATED`. Returns `{ ok: true } | { ok: false, reason: 'INVALID' | 'NOT_FOUND' | 'NAME_TAKEN' }`.
- `deleteTemplate({ id, actorUserId })` — deletes; audits `EMAIL_TEMPLATE_DELETED`. Returns `{ ok: true } | { ok: false, reason: 'NOT_FOUND' }`.
- `listTemplates()` — all templates, newest-updated first.
- `getTemplate(id)` — one template or `null`.

Validation schema lives in `src/lib/validation/emailTemplates.ts`.

## 5. HR: send a custom email

`SUPER_ADMIN` and `HR_MANAGER`.

### 5.1 Application detail

A new "Send email" `<Card>` on `src/app/dashboard/hr/applications/[id]/page.tsx`, below the existing detail cards. A client component `SendEmailForm` fetches the templates list (passed from the server page) and the resolved variables:

1. HR picks a template from a dropdown (or "Blank").
2. The form interpolates the chosen template's subject and body against the application's variables (`buildEmailVars(application)`) and pre-fills two editable fields:
   - Subject — plain `<Input>`.
   - Body — `<RichTextEditor>`.
3. Submit calls `sendCustomEmailAction(applicationId, fd)`.

### 5.2 Standalone compose

A new page `src/app/dashboard/hr/compose/page.tsx`:

1. Candidate picker — a `<select>` populated by candidates with the role `CANDIDATE` (id + name + email; small enough at MVP scale).
2. Optional job picker — `<select>` of `listJobsForHr()` (id + title).
3. Template picker + Subject + Body, same as the application-detail form.

Variables resolve from the selected candidate + optional job. Submit calls a parallel `sendCustomEmailComposeAction(fd)`.

### 5.3 Send service

`src/lib/email/sendCustom.ts`:

```ts
sendCustomEmail({ to, toName, subject, html, sourceTemplateId? }): Promise<void>
```

Pipeline:
- `sanitizeRichHtml(html)` — defence in depth.
- `wrapInLayout(html, { previewText: subject })` — same layout helper used by `renderTemplate`.
- Send via the existing transport (`getTransport()` honours `EMAIL_TEST_MODE`).
- Write an `EmailLog` row with `template: 'hr-custom'`, `to`, `subject`, and metadata `{ sourceTemplateId? }`. Never throws — wrapped in the same `try/catch` contract as `sendEmail`.

Server actions:
- `src/app/dashboard/hr/applications/[id]/sendEmailAction.ts` — `sendCustomEmailAction`. `requireAnyRole(['SUPER_ADMIN', 'HR_MANAGER'])`; reads `templateId` (optional, for logging), `subject`, `body` from `FormData`; loads the application (with candidate + job) for `to` + `toName`; calls `sendCustomEmail`; writes an `HR_EMAIL_SENT` audit row with `entityType: 'Application'`, `entityId: applicationId`, metadata `{ subject, sourceTemplateId? }`.
- `src/app/dashboard/hr/compose/actions.ts` — `sendCustomEmailComposeAction`. Same role gate; reads `candidateUserId`, optional `jobId`, `templateId`, `subject`, `body`; loads the candidate; calls `sendCustomEmail`; audit `HR_EMAIL_SENT` with `entityType: 'User'`, `entityId: candidateUserId`.

## 6. RBAC

| Action | Roles |
|---|---|
| List/create/edit/delete `EmailTemplate` | `SUPER_ADMIN` |
| Send a custom email | `SUPER_ADMIN`, `HR_MANAGER` |
| View the admin email-templates page | `SUPER_ADMIN` |
| View the standalone compose page | `SUPER_ADMIN`, `HR_MANAGER` |

Enforced in server actions via `requireRole` / `requireAnyRole`, and on each protected page via the same checks.

## 7. Tests

- `emailTemplateService.test.ts` — create/update/delete happy paths; unique-name violation returns `NAME_TAKEN`; missing template returns `NOT_FOUND`; body is sanitised on save (input `<script>` is stripped from the persisted row).
- `sendCustom.test.ts` — `sendCustomEmail` writes an `EmailLog` row with `template: 'hr-custom'`, the right `to`/`subject`, and the sanitised body; does not throw on transport failure (matches the `sendEmail` contract).
- `vars.test.ts` — `buildEmailVars` returns the right values from an application; standalone path returns empty strings for unavailable tokens.

## 8. Sequencing

1. Prisma schema + migration; `resetDb` update.
2. Validation schema + `emailTemplateService` (TDD).
3. Admin UI: list page, new/edit pages, server actions.
4. `buildEmailVars` + `sendCustomEmail` (TDD).
5. `SendEmailForm` + `sendCustomEmailAction`; wire into the application detail page.
6. `/dashboard/hr/compose` page + `sendCustomEmailComposeAction`.

Each step keeps the app deployable.
