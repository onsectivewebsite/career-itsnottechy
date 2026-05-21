# Phase 10 — Saved Jobs & Job Alerts — Design Spec

**Date:** 2026-05-20
**Status:** Approved for planning
**Builds on:** Phase 9 (`2026-05-20-phase-9-content-and-rich-editor-design.md`), merged to `main` and deployed.
**Roadmap item:** P0 — "Saved jobs & job alerts" (`docs/superpowers/roadmap.md`).

## 1. Overview

Two related candidate-facing features:

- **Part A — Saved jobs.** A candidate can save (bookmark) a job and see their saved roles on their dashboard.
- **Part B — Job alerts.** A candidate can opt in to be emailed whenever a new role is published.

Both increase return visits and applications. One database migration, one implementation plan; Part A first, then Part B.

### Success criteria

- A logged-in candidate can save and unsave a job from the job detail page and the jobs list.
- The candidate dashboard shows the candidate's saved jobs.
- A candidate can turn job alerts on/off from their dashboard.
- When HR publishes a previously-draft role, every candidate with alerts enabled receives an email.
- `npm test` green; `npm run build` succeeds.

### Out of scope

- Filtered alerts (by department/location/type) — alerts cover *all* newly published roles. Decided during brainstorming.
- Digest emails / scheduled sending — alerts send immediately on publish.
- Save controls for guests or staff — only logged-in candidates see them.
- Re-notifying on re-opened roles — alerts fire only on the first DRAFT → OPEN transition.
- Background job queue for the send loop — synchronous send is acceptable at current scale (queue is a separate roadmap item).

## 2. Part A — Saved jobs

### 2.1 Data model

New model `SavedJob` — a join table between a candidate and a job:

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

`User` gains `savedJobs SavedJob[] @relation("CandidateSavedJobs")`; `Job` gains `savedBy SavedJob[]`. Migration name: `add_saved_jobs_and_alerts` (shared with Part B). `SavedJob` is added to the `resetDb` truncation list.

### 2.2 Service — `savedJobService`

`src/lib/services/savedJobService.ts`:

- `toggleSavedJob({ candidateUserId, jobId })` — if a `SavedJob` row exists, delete it and return `{ ok: true, saved: false }`; otherwise create it and return `{ ok: true, saved: true }`. If the job does not exist, return `{ ok: false, reason: 'JOB_NOT_FOUND' }`.
- `listSavedJobs(candidateUserId)` — the candidate's saved jobs with job details (title, department, location, type, status), newest-saved first.
- `getSavedJobIds(candidateUserId)` — a `Set<string>` of saved job ids, for rendering save state across a list without N queries.

### 2.3 UI

- **`SaveJobButton`** (`src/components/jobs/SaveJobButton.tsx`, client component) — props `jobId`, `initialSaved`. Renders a "Save" / "Saved" toggle; calls the `toggleSavedJobAction` server action and reflects the returned state.
- **`toggleSavedJobAction`** (`src/app/jobs/savedJobActions.ts`, server action) — `requireRole(CANDIDATE)`, calls `toggleSavedJob`, revalidates the jobs pages and the candidate dashboard.
- **Job detail page** (`src/app/jobs/[id]/page.tsx`) — when the viewer is a logged-in `CANDIDATE`, render `<SaveJobButton>` with the current saved state. Guests and staff see no button.
- **Jobs list** (`src/app/jobs/page.tsx`) — when the viewer is a logged-in `CANDIDATE`, fetch `getSavedJobIds` once and render a `SaveJobButton` on each card.
- **Candidate dashboard** (`src/app/dashboard/candidate/page.tsx`) — a "Saved jobs" card listing saved roles (title + department + status badge, linked to the job), or an empty-state line.

## 3. Part B — Job alerts

### 3.1 Data model

`CandidateProfile` gains one field:

```prisma
jobAlertsEnabled Boolean @default(false)
```

Every candidate already has a `CandidateProfile` row (created in `userService.createUser` and in the seed), so no new table is needed and the toggle has a reliable home. The toggle action uses `upsert` keyed on `userId` as a safety net.

### 3.2 Service — `jobAlertService`

`src/lib/services/jobAlertService.ts`:

- `setJobAlerts({ candidateUserId, enabled })` — upserts the candidate's `CandidateProfile` with `jobAlertsEnabled = enabled`.
- `notifyNewJob(job)` — finds every `CandidateProfile` with `jobAlertsEnabled = true`, and for each sends a `job-alert` email (`sendEmail`, which never throws). Returns the count notified.

### 3.3 Publish hook

`jobService.publishJob` currently flips a job to `OPEN` with an atomic `updateMany` and works for both first publish (DRAFT → OPEN) and re-opening (CLOSED → OPEN). It is changed to: read the job, detect whether its current status is `DRAFT`, perform the update, record the audit entry, and — only when the prior status was `DRAFT` — call `jobAlertService.notifyNewJob(job)`. This guarantees alerts fire once per posting and never on a re-open. (The `updateMany`-based race guard is replaced by a `findUnique` + `update`; publishing is an HR action with no real contention.)

### 3.4 Email

New template `job-alert` (`src/emails/templates/job-alert.html`), registered in `src/lib/email/templates.ts`. Template data: `{ name: string; jobTitle: string; jobUrl: string }`. Subject: `New role at It's Not Techy: <jobTitle>`. `jobUrl` is `${APP_URL}/jobs/<id>`. Recorded in `EmailLog` like every other send.

### 3.5 UI

The candidate dashboard gains a **job-alerts toggle** — a small form ("Email me when new roles are posted", on/off) backed by a `setJobAlertsAction` server action (`requireRole(CANDIDATE)` → `setJobAlerts`). The dashboard reads the current `jobAlertsEnabled` value to render the toggle's state.

## 4. RBAC

| Action | Role |
|--------|------|
| Save/unsave a job | the `CANDIDATE` (their own saves) |
| View saved jobs | the `CANDIDATE` (their own) |
| Toggle job alerts | the `CANDIDATE` (their own profile) |
| Trigger alert emails | side effect of HR publishing a job — no candidate action |

Enforced in the server actions via `requireRole` / `requireAnyRole`, consistent with the rest of the app.

## 5. Tests

- `savedJobService.test.ts` — toggle creates then removes; `listSavedJobs` returns newest-first with job data; `getSavedJobIds` returns the right set; unknown job → `JOB_NOT_FOUND`.
- `jobAlertService.test.ts` — `setJobAlerts` flips the flag; `notifyNewJob` emails only candidates with alerts enabled and writes `EmailLog` rows.
- `jobService.test.ts` — existing publish/close tests still pass; a new test confirms publishing a DRAFT job sends alert emails to opted-in candidates and that re-opening a CLOSED job does not.

## 6. Sequencing

1. Prisma schema + migration (`SavedJob`, `CandidateProfile.jobAlertsEnabled`), `resetDb` update.
2. `savedJobService` (TDD).
3. `SaveJobButton` + `toggleSavedJobAction`; wire into job detail page, jobs list, and the candidate dashboard "Saved jobs" card.
4. `jobAlertService` (TDD) + `job-alert` email template.
5. `publishJob` hook; candidate-dashboard alerts toggle + `setJobAlertsAction`.

Each step keeps the app deployable.
