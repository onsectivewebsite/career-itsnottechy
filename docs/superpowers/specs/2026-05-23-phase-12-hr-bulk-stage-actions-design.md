# Phase 12 — HR Bulk Stage Actions — Design Spec

**Date:** 2026-05-23
**Status:** Approved for planning
**Builds on:** Phase 11 (HR email templates), merged to `main` and deployed.
**Roadmap item:** P0 — "HR bulk stage actions" (`docs/superpowers/roadmap.md`).

## 1. Overview

Let HR select multiple applications from an applicants list and move them through the pipeline in one action. Removes the per-application click cost during triage.

The pipeline + transitions stay exactly as they are today: forward stages live in `src/lib/ats/stages.ts` (`FORWARD` map), each single-app move runs through `moveStage` in `atsService.ts`, and stage moves emit the existing `application-status-changed` (and `offer-sent`, where relevant) emails and `APP_STAGE_CHANGED` audit rows. The bulk feature is a thin layer on top — no schema change, no new email, no migration.

### Success criteria

- On `/dashboard/hr/jobs/[id]/applicants` and `/dashboard/hr/applicants`, HR can:
  - Check multiple applications.
  - Pick **Advance** — each app moves to its next forward stage (`FORWARD[stage][0]`).
  - Pick **Reject** (with a confirmation prompt) — every selected app moves to `REJECTED`.
  - Pick **Move to → ‹stage›** — every selected app moves to that target stage if the transition is valid.
- The action returns a summary: `N moved, M skipped` (where skipped covers `NOT_FOUND`, terminal stages, and invalid transitions).
- Existing single-app `moveStage` is reused for each item, so audit rows and stage emails fire exactly as today.
- `npm test` green; `npm run build` succeeds.

### Out of scope

- Bulk actions other than stage moves (no bulk delete, no bulk note, no bulk email — the latter is already covered by Phase 11's compose page).
- Server-side concurrency batching / queueing — the loop is sequential and synchronous (HR triage is human-paced, batches are tens, not thousands).
- A "select all stages and across pages" cross-tab selection — only what's on the current page is selectable.
- Undo. (A mistaken move is fixed by another move — every stage transition stands on its own and is auditable.)

## 2. Data model

None. No schema change.

## 3. Service layer

### 3.1 `bulkMoveStage` (extends `src/lib/services/atsService.ts`)

```ts
export type BulkMoveResult = {
  applied: number;
  skipped: { applicationId: string; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' }[];
};

export type BulkMoveInput = {
  applicationIds: string[];
  mode: 'advance' | 'set';
  toStage?: AppStage;       // required when mode === 'set'
  actorUserId: string;
};

export async function bulkMoveStage(args: BulkMoveInput): Promise<BulkMoveResult>;
```

Per id, in order:

1. Look up the application's current stage (`prisma.application.findUnique`, `select: { stage: true }`).
2. If missing → skip with `NOT_FOUND`.
3. Compute the target:
   - `mode = 'advance'` → `FORWARD[currentStage][0]` (the natural advance; `HIRED` / `REJECTED` have no forward target → skip `INVALID_TRANSITION`).
   - `mode = 'set'` → `toStage`; if absent → skip `INVALID_TRANSITION`.
4. Call the existing single-app `moveStage({ applicationId: id, toStage: target, actorUserId })`. Its return is `MoveResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' }`.
5. On `{ ok: true }` increment `applied`; on `{ ok: false }` push the reason onto `skipped`.

The atomic claim, audit row, and stage email fire inside `moveStage` exactly as they do today; the bulk function adds nothing beyond the loop. (The N-emails-in-a-loop pattern is acceptable at MVP scale; `sendEmail` honours its never-throws contract, so one bad address cannot abort the batch.)

### 3.2 Tests

`src/lib/services/atsService.test.ts` (extend):

- `bulkMoveStage` with `mode: 'advance'` on three `APPLIED` apps moves all three to `SCREENING`; `applied === 3`, `skipped === []`.
- `bulkMoveStage` with `mode: 'advance'` on a mix where one app is `HIRED` returns `applied: 2, skipped: [{ id, reason: 'INVALID_TRANSITION' }]`.
- `bulkMoveStage` with `mode: 'set', toStage: 'REJECTED'` works regardless of current stage (every non-terminal app moves; `HIRED`/`REJECTED` already-at-terminal apps return `INVALID_TRANSITION`).
- Unknown id → `skipped` with `NOT_FOUND`.

## 4. Server action

`src/app/dashboard/hr/_actions/bulkStageAction.ts`:

```ts
'use server';
type FormState = { error?: string; ok?: true; summary?: string };
export async function bulkStageAction(prev: FormState | undefined, fd: FormData): Promise<FormState>;
```

- `requireAnyRole(getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER'])`.
- Reads `applicationIds = fd.getAll('applicationIds').map(String).filter(Boolean)`.
- Reads `bulkAction = fd.get('bulkAction')` — one of `'advance' | 'reject' | 'set'`.
- Reads `toStage = fd.get('toStage')` (used only when `bulkAction === 'set'`).
- Empty selection → `{ error: 'Pick at least one applicant.' }`.
- Dispatches to `bulkMoveStage` (mapping `'reject'` → `mode: 'set', toStage: 'REJECTED'`).
- Returns `{ ok: true, summary: '${applied} moved, ${skipped.length} skipped.' }`.
- `revalidatePath('/dashboard/hr/applicants')` and `revalidatePath('/dashboard/hr/jobs/[id]/applicants', 'page')` so both list views refresh.

## 5. UI components

A small shared sub-component plus one page-specific wrapper per list view.

### 5.1 `BulkActionsBar` (client, shared)

`src/components/applicants/BulkActionsBar.tsx` — props: `selectedCount: number`. Renders the action controls inside the surrounding `<form>`:

- Disabled when `selectedCount === 0`.
- `Advance` — `<button type="submit" name="bulkAction" value="advance">` (disabled when 0).
- `Reject` — `<button type="submit" name="bulkAction" value="reject">` with an `onClick` that triggers `window.confirm('Reject ${selectedCount} application(s)?')` and prevents submit on cancel.
- `Move to →` group: `<select name="toStage">` listing every `AppStage` label, plus `<button type="submit" name="bulkAction" value="set">Move</button>`.
- A summary line bound to `useFormState` shows the result alert.

### 5.2 `BulkApplicantsByStage` (client, per-job)

`src/app/dashboard/hr/jobs/[id]/applicants/BulkApplicantsByStage.tsx` — props: `apps: AppRow[]`. Maintains a `Set<string>` of selected ids. Renders the page's existing kanban-by-stage grouping but with a checkbox on each card. Wraps the whole list + the `BulkActionsBar` in one `<form action={bulkStageAction}>`.

### 5.3 `BulkApplicantsFlat` (client, all-applicants)

`src/app/dashboard/hr/applicants/BulkApplicantsFlat.tsx` — props: `apps: AppRow[]`. Same as above but renders a flat list (job + stage badges per row), again wrapped in one form with the bulk action bar.

### 5.4 Page changes

- `src/app/dashboard/hr/jobs/[id]/applicants/page.tsx` — replaces the in-page list rendering with `<BulkApplicantsByStage apps={apps} />`. Server still fetches and gates.
- `src/app/dashboard/hr/applicants/page.tsx` — replaces the in-page list with `<BulkApplicantsFlat apps={apps} />`.

Both pages keep their existing heading + summary lines unchanged.

## 6. RBAC

| Action | Roles |
|---|---|
| Render either applicants list | `SUPER_ADMIN`, `HR_MANAGER` (unchanged) |
| Submit `bulkStageAction` | `SUPER_ADMIN`, `HR_MANAGER` |

Enforced on the existing server-page checks and again in the new server action via `requireAnyRole`.

## 7. Failure modes & edge cases

| Case | Handled by |
|---|---|
| Zero applications selected | The action returns `{ error }`; buttons also disabled client-side. |
| App already terminal (`HIRED` / `REJECTED`) and "Advance" chosen | `INVALID_TRANSITION` skip from the `FORWARD` map check. |
| App's target stage is invalid for its current stage (e.g. "Move to OFFER" from `APPLIED`) | `INVALID_TRANSITION` skip via `moveStage`'s existing validation. |
| Concurrent move by another HR user | Atomic compound `updateMany` claim inside `moveStage`; the loser returns `INVALID_TRANSITION` and is counted in `skipped`. |
| Single bad email address | `sendEmail` swallows; the batch continues; the move is still applied + audited. |
| User clicks Reject by accident | Browser `window.confirm('Reject N application(s)?')` before submit. |

## 8. Sequencing

1. `bulkMoveStage` + tests (TDD).
2. `bulkStageAction` server action.
3. `BulkActionsBar` shared component.
4. `BulkApplicantsByStage` + per-job page wiring.
5. `BulkApplicantsFlat` + all-applicants page wiring.

Each step keeps the app deployable.
