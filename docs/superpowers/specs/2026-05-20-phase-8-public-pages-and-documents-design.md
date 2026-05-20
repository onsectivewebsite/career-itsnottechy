# Phase 8 — Public Pages & Required Documents — Design Spec

**Date:** 2026-05-20
**Status:** Approved for planning
**Builds on:** the seven-phase build in `2026-05-17-itsnottechy-careers-design.md`, all of which is complete and merged to `main`.

## 1. Overview

Phase 8 adds two independent bodies of work to the deployed careers portal:

- **Part A — Public content pages.** Four new marketing/informational pages plus an enriched Home page, giving candidates a real sense of the company before they apply.
- **Part B — Required documents.** Lets HR demand named documents from applicants — both *at job creation* (collected during the apply flow) and *later* (requested from a specific candidate mid-pipeline).

The two parts share no code. Part A ships first (no database migration, low risk); Part B follows (one migration). Both fit a single implementation plan.

### Success criteria

- Four new public pages render with brand styling and are reachable from the nav and footer.
- HR can attach a list of required documents to a job; the apply form enforces the required ones.
- HR can request an additional document from an applicant after they have applied; the candidate is emailed and can upload it from their dashboard.
- HR can view and download every document attached to an application.
- `npm test` green; `npm run build` succeeds.

### Out of scope

- Document versioning / re-upload history (latest upload wins).
- Virus scanning of uploads (existing `/api/upload` limits stand: type + 5 MB size).
- Document approval/rejection workflow — a document is either `PENDING` (requested, not uploaded) or `SUBMITTED`. HR judgement happens out-of-band.
- CMS / editable page content — Part A pages are static server components with content in the source.

## 2. Part A — Public content pages

All pages are React Server Components under `src/app/`, reusing `PublicNav`, the brand teal/ink theme, the dark hero band, and the footer pattern established on the Home page. Content is written from the real company profile (global digital marketing agency, founded 2024, HQ Toronto, 8 offices, official marketing partner of Onsective Inc.). No data-model or API changes.

### 2.1 Routes and content

| Route | Page | Sections |
|-------|------|----------|
| `/culture` | Culture & Belonging | Hero; our values (3–4 value cards); how we work (senior practitioners, outcomes over hours); diversity, equity & belonging statement; CTA to open roles |
| `/benefits` | Benefits & Perks | Hero; compensation philosophy; remote/hybrid working; time off & wellbeing; learning & growth; perks grid |
| `/resources` | Candidate Resources | Hero; the hiring process (4 stages: Apply → Review → Interview → Offer); interview preparation tips; FAQ (expandable list); CTA |
| `/life` | Life & Offices | Hero; the 8 offices (Toronto HQ, New York, London, Dubai, Mumbai, Singapore, Sydney, Berlin) as a card grid; a day-in-the-life narrative; CTA |

### 2.2 Shared changes

- **`PublicNav`** — add links to `/culture`, `/benefits`, `/resources`, `/life` alongside "Open roles". "Sign in" / "Create account" stay as buttons.
- **Footer** — replace the single-line footer with a small sitemap (the four pages + Open roles + Sign in) above the copyright line. Apply the same footer to all public pages, ideally via a shared `PublicFooter` component extracted from the current Home footer.
- **Home** — add a "Why It's Not Techy" stats/value band and a section with cards linking to the four new pages. Keep the existing hero, why-apply, and About sections.

### 2.3 New / changed files (Part A)

- Create: `src/app/culture/page.tsx`, `src/app/benefits/page.tsx`, `src/app/resources/page.tsx`, `src/app/life/page.tsx`
- Create: `src/components/PublicFooter.tsx` (extracted shared footer)
- Modify: `src/components/PublicNav.tsx`, `src/app/page.tsx`

## 3. Part B — Required documents

### 3.1 Data model

**`Job` gains one field**, mirroring the existing `customQuestions` JSON pattern:

```prisma
requiredDocuments Json @default("[]")
```

`requiredDocuments` JSON schema (validated server-side with Zod):

```ts
type RequiredDocument = {
  id: string;          // stable id, generated client-side
  name: string;        // e.g. "Portfolio", "Government-issued ID"
  required: boolean;   // must be uploaded for the application to submit
  instructions?: string;
};
```

**New model `ApplicationDocument`** — a single table serves both the apply-time and HR-requested flows:

```prisma
enum DocumentStatus {
  PENDING     // HR requested it; candidate has not uploaded yet
  SUBMITTED   // file uploaded
}

model ApplicationDocument {
  id            String         @id @default(cuid())
  applicationId String
  application   Application    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  label         String         // document name
  instructions  String?        @db.Text
  fileUrl       String?        // null while PENDING
  status        DocumentStatus @default(SUBMITTED)
  requestedById String?        // set when HR requested it post-apply; null = collected at apply time
  requestedBy   User?          @relation("DocumentsRequested", fields: [requestedById], references: [id])
  createdAt     DateTime       @default(now())
  submittedAt   DateTime?

  @@index([applicationId])
}
```

`Application` gains `documents ApplicationDocument[]`; `User` gains `documentsRequested ApplicationDocument[] @relation("DocumentsRequested")`. Migration name: `add_application_documents`.

A document collected at apply time is born `SUBMITTED` with `requestedById = null`. An HR-requested document is born `PENDING` with `requestedById` set, and flips to `SUBMITTED` (with `fileUrl` + `submittedAt`) when the candidate uploads.

### 3.2 Flows

**3.2.1 HR defines required documents (job creation/edit).** A new `RequiredDocumentsEditor` client component in `JobForm` — modeled on the existing `CustomQuestionsEditor` — lets HR add rows of `{ name, required, instructions }`. Persisted to `Job.requiredDocuments` via the existing job create/update server actions and validated by a new Zod schema in `src/lib/validation/jobs.ts`.

**3.2.2 Candidate applies.** `ApplyForm` renders one file-upload field per `Job.requiredDocuments` entry, alongside the existing resume upload. Files upload through the existing `POST /api/upload`. On submit, the apply server action validates that every `required: true` document has a file (same rejection pattern as missing required custom questions) and creates one `ApplicationDocument` (`status = SUBMITTED`, `requestedById = null`) per uploaded file.

**3.2.3 HR requests a document later.** On the HR application-detail page (`src/app/dashboard/hr/applications/[id]`), a "Request a document" form takes a name + optional instructions and creates an `ApplicationDocument` with `status = PENDING`, `requestedById = <HR user>`. This sends a `DOCUMENT_REQUESTED` email to the candidate and writes a `DOCUMENT_REQUESTED` audit-log entry.

**3.2.4 Candidate fulfils a request.** The candidate dashboard surfaces their `PENDING` documents (across all their applications) with an upload control. Uploading sets `fileUrl`, `submittedAt`, `status = SUBMITTED`, and writes a `DOCUMENT_SUBMITTED` audit-log entry.

**3.2.5 HR reviews documents.** The HR application-detail page lists every `ApplicationDocument` for the application — submitted ones as authenticated download links, pending ones flagged as awaiting upload.

### 3.3 Service layer

A new `documentService` in `src/lib/services/documentService.ts` (with `documentService.test.ts`, TDD) owns: creating apply-time documents, creating HR requests, fulfilling a request, and listing documents for an application or candidate. Required-document validation logic lives next to the existing custom-question validation.

### 3.4 File storage & serving

Documents use the existing storage layer (`src/lib/storage.ts`, `STORAGE_ROOT`) and upload route. Stored under `applications/<applicationId>/documents/`. `GET /api/files/[...path]` ownership checks (via `fileAclService`) are extended so that: the owning candidate may fetch their own application's documents, and HR may fetch documents for any application.

### 3.5 Email & audit

- **Email event `DOCUMENT_REQUESTED`** → candidate: "A document has been requested for your application." New template under `src/emails/templates/`, sent through the existing `src/lib/email` infrastructure, recorded in `EmailLog`.
- **Audit events** `DOCUMENT_REQUESTED` and `DOCUMENT_SUBMITTED`, written via the existing `src/lib/audit.ts` / `auditService`.

### 3.6 RBAC

| Action | Allowed roles |
|--------|---------------|
| Define `requiredDocuments` on a job | same roles that create/edit jobs (`HR_MANAGER`) |
| Request a document from an applicant | `HR_MANAGER` |
| View/download an application's documents | `HR_MANAGER`; the owning `CANDIDATE` for their own application |
| Upload a requested document | the owning `CANDIDATE` |

No new capability rows beyond reusing existing job-edit and application-view permissions; enforced in server actions and `fileAclService`.

### 3.7 New / changed files (Part B)

- Modify: `prisma/schema.prisma` (+ migration `add_application_documents`)
- Create: `src/lib/services/documentService.ts` (+ test)
- Modify: `src/lib/validation/jobs.ts` (requiredDocuments schema)
- Create: `src/components/jobs/RequiredDocumentsEditor.tsx`
- Modify: `src/components/jobs/JobForm.tsx`, job create/edit server actions
- Modify: `src/app/jobs/[id]/apply/ApplyForm.tsx` and `actions.ts`
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx` (+ request-document action)
- Modify: the candidate dashboard to surface pending document requests (+ upload action)
- Modify: `src/lib/services/fileAclService.ts`, `src/app/api/files/[...path]/route.ts`
- Create: `DOCUMENT_REQUESTED` email template under `src/emails/templates/`
- Modify: `src/lib/audit.ts` (new event names)

## 4. Sequencing

1. **Part A** — public pages, nav, footer, Home enrichment. No migration. Ships independently.
2. **Part B** — migration + `documentService` (TDD) → validation + JobForm editor → apply flow → HR request flow + email → candidate fulfilment → file-serving ACL.

Each step keeps the app deployable, consistent with the original build's "always deployable" ordering.
