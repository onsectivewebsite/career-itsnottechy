# Phase 5 — Interviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR can schedule an interview from an application's HR detail page. Both candidate and interviewer get an email with an `.ics` calendar attachment. The interviewer sees their upcoming interviews on a shared dashboard widget; the candidate sees theirs on `/dashboard/candidate`. Scheduling against an interviewer who already has a time conflict produces a warning the HR user must explicitly confirm to bypass.

**Architecture:**
- New `interviewService` owns `scheduleInterview` (with conflict detection), `listInterviewsForUser`, `listInterviewsForApplication`, `cancelInterview`.
- Conflict check uses the `(interviewerUserId, scheduledAt)` index from the schema — counts any `SCHEDULED` interview whose time window overlaps the proposed slot. The form submits in two modes: `check` (returns conflict info) and `force` (skips the warning gate).
- `.ics` generation is a small pure-function utility in `src/lib/ics/`.
- `sendEmail` already accepts `attachments: Attachment[]` — no transport changes needed.
- New shared `<MyInterviewsWidget />` component renders the upcoming list; embedded on HR/manager/employee/candidate dashboards.

**Tech Stack:** Same as prior phases (Next 14 / TS strict + noUncheckedIndexedAccess / Prisma / vitest / Tailwind).

**Prerequisites:** Phase 4 complete (tag `phase-4-complete`). 173 tests passing.

**End-of-plan state:** Full interview lifecycle (schedule → notify → display → cancel) shipping. One new email template (`interview-scheduled`) with `.ics` attachment. HR scheduling UI on application detail. "My Interviews" widget on 4 dashboards. ~190 tests total.

---

## Task 1: Interview validation + types

**Files:**
- Create: `src/lib/validation/interviews.ts`, `src/lib/validation/interviews.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/validation/interviews.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { interviewInputSchema } from './interviews';

describe('interviewInputSchema', () => {
  it('accepts a minimal valid interview', () => {
    const r = interviewInputSchema.parse({
      applicationId: 'app-1',
      scheduledAt: '2026-06-01T14:00:00.000Z',
      durationMinutes: 45,
      format: 'VIDEO',
      interviewerUserId: 'user-1',
      locationOrLink: 'https://meet.example.com/abc',
    });
    expect(r.scheduledAt).toBeInstanceOf(Date);
    expect(r.notes).toBeUndefined();
  });

  it('rejects past scheduledAt', () => {
    expect(() => interviewInputSchema.parse({
      applicationId: 'app-1',
      scheduledAt: '2020-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'VIDEO', interviewerUserId: 'u',
      locationOrLink: 'https://x',
    })).toThrow();
  });

  it('rejects duration < 15 or > 240', () => {
    const base = {
      applicationId: 'app-1', scheduledAt: '2099-01-01T00:00:00.000Z',
      format: 'VIDEO' as const, interviewerUserId: 'u', locationOrLink: 'x',
    };
    expect(() => interviewInputSchema.parse({ ...base, durationMinutes: 10 })).toThrow();
    expect(() => interviewInputSchema.parse({ ...base, durationMinutes: 300 })).toThrow();
  });

  it('rejects empty locationOrLink', () => {
    expect(() => interviewInputSchema.parse({
      applicationId: 'a', scheduledAt: '2099-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'VIDEO', interviewerUserId: 'u', locationOrLink: '',
    })).toThrow();
  });

  it('passes notes through (trimmed) when provided', () => {
    const r = interviewInputSchema.parse({
      applicationId: 'a', scheduledAt: '2099-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'PHONE', interviewerUserId: 'u',
      locationOrLink: '+1-555-0100', notes: '  please be ready  ',
    });
    expect(r.notes).toBe('please be ready');
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/validation/interviews.ts`:
```ts
import { z } from 'zod';

export const interviewInputSchema = z.object({
  applicationId: z.string().min(1),
  // Accept ISO string from form, coerce to Date, validate it's in the future.
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'Interview must be scheduled in the future.',
  }),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  format: z.enum(['VIDEO', 'PHONE', 'IN_PERSON']),
  interviewerUserId: z.string().min(1),
  locationOrLink: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(2000).optional(),
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;
```

- [ ] **Step 4: Run + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test -- src/lib/validation/interviews.test.ts
git add src/lib/validation/interviews.ts src/lib/validation/interviews.test.ts
git commit -m "feat(validation): add interview input schema"
```

---

## Task 2: `.ics` generator utility

**Files:**
- Create: `src/lib/ics/buildIcs.ts`, `src/lib/ics/buildIcs.test.ts`

The output is a single VCALENDAR string compliant enough for Apple/Google/Outlook clients. We DO NOT need RSVP, alarms, or multiple attendees per event — keep it minimal.

- [ ] **Step 1: Write failing tests**

`src/lib/ics/buildIcs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildIcs } from './buildIcs';

describe('buildIcs', () => {
  const base = {
    uid: 'interview-cuid-123@itsnottechy.com',
    title: 'Interview: Jordan Reed — Software Engineer',
    description: 'Video interview with HR.\nLink: https://meet.example.com/abc',
    location: 'https://meet.example.com/abc',
    start: new Date('2026-06-01T14:00:00.000Z'),
    durationMinutes: 45,
    organizerEmail: 'hr@itsnottechy.com',
    organizerName: 'ItsNotTechy HR',
  };

  it('produces a VCALENDAR with required fields', () => {
    const ics = buildIcs(base);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:interview-cuid-123@itsnottechy.com');
    expect(ics).toContain('DTSTART:20260601T140000Z');
    expect(ics).toContain('DTEND:20260601T144500Z');     // 45 minutes later
    expect(ics).toContain('SUMMARY:Interview: Jordan Reed');
    expect(ics).toContain('LOCATION:https://meet.example.com/abc');
    expect(ics).toContain('ORGANIZER;CN=ItsNotTechy HR:mailto:hr@itsnottechy.com');
  });

  it('escapes commas, semicolons, and newlines per RFC 5545', () => {
    const ics = buildIcs({ ...base, title: 'A; B, C\nD', description: 'x; y, z\n' });
    expect(ics).toContain('SUMMARY:A\\; B\\, C\\nD');
    expect(ics).toContain('DESCRIPTION:x\\; y\\, z\\n');
  });

  it('uses CRLF line endings (RFC 5545 §3.1)', () => {
    const ics = buildIcs(base);
    expect(ics).toMatch(/BEGIN:VCALENDAR\r\n/);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('computes DTEND correctly for non-45 durations', () => {
    const ics = buildIcs({ ...base, durationMinutes: 30 });
    expect(ics).toContain('DTSTART:20260601T140000Z');
    expect(ics).toContain('DTEND:20260601T143000Z');
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/ics/buildIcs.ts`:
```ts
export type IcsInput = {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes: number;
  organizerEmail: string;
  organizerName: string;
};

/**
 * Build a minimal RFC 5545 VCALENDAR/VEVENT block.
 *
 * Output is a single string with CRLF line endings — that's what mail clients
 * expect when the body is attached as text/calendar. We deliberately skip
 * line-folding at column 75 because all our fields are short enough that
 * folding never triggers, and dropping the fold logic keeps the code simple.
 */
export function buildIcs(input: IcsInput): string {
  const dtstamp = formatUtc(new Date());
  const dtstart = formatUtc(input.start);
  const dtend = formatUtc(new Date(input.start.getTime() + input.durationMinutes * 60_000));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ItsNotTechy//Careers//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    `LOCATION:${escapeText(input.location)}`,
    `ORGANIZER;CN=${input.organizerName}:mailto:${input.organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** UTC timestamp in YYYYMMDDTHHMMSSZ — the form RFC 5545 §3.3.5 expects. */
function formatUtc(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm   = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd   = d.getUTCDate().toString().padStart(2, '0');
  const hh   = d.getUTCHours().toString().padStart(2, '0');
  const mi   = d.getUTCMinutes().toString().padStart(2, '0');
  const ss   = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/** RFC 5545 §3.3.11 text escaping: backslash, semicolon, comma, newline. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
```

- [ ] **Step 4: Run + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test -- src/lib/ics/buildIcs.test.ts
git add src/lib/ics/buildIcs.ts src/lib/ics/buildIcs.test.ts
git commit -m "feat(ics): add minimal RFC 5545 .ics generator"
```

---

## Task 3: Email template + registry entry

**Files:**
- Create: `src/emails/templates/interview-scheduled.html`
- Modify: `src/lib/email/templates.ts` (add `'interview-scheduled'` entry to `TemplateData` and `subjects`)

The template is rendered with the same `{{var}}` interpolator used by the other templates (see `src/lib/email/templates.ts` for the rendering pattern).

- [ ] **Step 1: Create the HTML template**

`src/emails/templates/interview-scheduled.html`:
```html
<p>Hi {{recipientName}},</p>
<p>An interview has been scheduled:</p>
<ul>
  <li><strong>Candidate:</strong> {{candidateName}}</li>
  <li><strong>Role:</strong> {{jobTitle}}</li>
  <li><strong>When:</strong> {{whenHuman}}</li>
  <li><strong>Duration:</strong> {{durationMinutes}} minutes</li>
  <li><strong>Format:</strong> {{formatLabel}}</li>
  <li><strong>{{locationLabel}}:</strong> {{locationOrLink}}</li>
</ul>
{{#notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/notes}}
<p>A calendar invite (.ics) is attached. Open it to add the event to your calendar.</p>
<p>{{footer}}</p>
```

**NOTE:** The `{{#notes}}…{{/notes}}` block-style conditional is NOT supported by the existing interpolator (it only does `{{var}}` substitution). Instead, the implementer should add `notesBlock` as a separate template variable — either an empty string OR `<p><strong>Notes:</strong> ...</p>` rendered at the call site. Adjust the template to:
```html
{{notesBlock}}
```
in place of the conditional, and build `notesBlock` in the service layer.

Final HTML:
```html
<p>Hi {{recipientName}},</p>
<p>An interview has been scheduled:</p>
<ul>
  <li><strong>Candidate:</strong> {{candidateName}}</li>
  <li><strong>Role:</strong> {{jobTitle}}</li>
  <li><strong>When:</strong> {{whenHuman}}</li>
  <li><strong>Duration:</strong> {{durationMinutes}} minutes</li>
  <li><strong>Format:</strong> {{formatLabel}}</li>
  <li><strong>{{locationLabel}}:</strong> {{locationOrLink}}</li>
</ul>
{{notesBlock}}
<p>A calendar invite (.ics) is attached. Open it to add the event to your calendar.</p>
```

- [ ] **Step 2: Extend `src/lib/email/templates.ts`**

Add to the `TemplateData` map:
```ts
  'interview-scheduled': {
    recipientName: string;
    candidateName: string;
    jobTitle: string;
    whenHuman: string;            // e.g. "Mon Jun 1, 2026 · 2:00 PM UTC"
    durationMinutes: string;      // template renderer takes strings — coerce at call site
    formatLabel: string;          // "Video", "Phone", "In person"
    locationLabel: string;        // "Meeting link" or "Phone" or "Location"
    locationOrLink: string;
    notesBlock: string;           // pre-rendered HTML fragment or ''
  };
```

Add to `subjects`:
```ts
  'interview-scheduled': (data) =>
    `Interview scheduled — ${data.candidateName} for ${data.jobTitle}`,
```

- [ ] **Step 3: Commit (no test for template registry — covered by service tests in Task 4)**

```bash
git add src/emails/templates/interview-scheduled.html src/lib/email/templates.ts
git commit -m "feat(email): add interview-scheduled template"
```

---

## Task 4: interviewService — schedule + list + conflict check

**Files:**
- Create: `src/lib/services/interviewService.ts`, `src/lib/services/interviewService.test.ts`

**Behavior contract:**
- `scheduleInterview({ input, force, scheduledByUserId })` validates input, checks for interviewer conflicts in the `[start, start+duration)` window, creates the row, fires email #6 to both candidate and interviewer (each with the `.ics` attached as `interview-<id>.ics`).
- If conflicts exist AND `force !== true`, returns `{ ok: false, reason: 'CONFLICT', conflicts: [{ id, scheduledAt, durationMinutes, applicationId }] }` and does NOT create the row.
- `listInterviewsForUser(userId)` returns interviews where the user is the candidate OR the interviewer, future-first, with `application.job.title` and `application.candidate.name` included.
- `listInterviewsForApplication(applicationId)` returns interviews for that application, ordered by `scheduledAt: 'asc'`, with interviewer name.
- `cancelInterview({ interviewId, actorUserId })` flips status to `CANCELLED` and records audit. Does NOT send a cancellation email in v1 (defer).

- [ ] **Step 1: Write failing tests**

`src/lib/services/interviewService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { createJob, publishJob } from './jobService';
import { submitApplication } from './applicationService';
import {
  scheduleInterview,
  listInterviewsForUser,
  listInterviewsForApplication,
  cancelInterview,
} from './interviewService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

const baseJob = {
  title: 'Software Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
  type: 'FULL_TIME' as const, description: 'long description here', requirements: 'Requirements here',
  customQuestions: [], currency: 'USD',
};

const futureIso = (offsetDays = 7) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString();

async function setupApp() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const j = await createJob({ input: baseJob, postedByUserId: hr.id });
  if (!j.ok) throw new Error();
  await publishJob({ jobId: j.jobId, actorUserId: hr.id });

  const cand = await prisma.user.create({
    data: { email: 'cand@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
  });
  const a = await submitApplication({
    jobId: j.jobId, candidateUserId: cand.id,
    input: { jobId: j.jobId, resumeUrl: 'r.pdf', customAnswers: {} },
  });
  if (!a.ok) throw new Error();

  const interviewer = await prisma.user.create({
    data: { email: 'iw@x.com', name: 'Iw', role: 'EMPLOYEE' },
  });
  return { hr, jobId: j.jobId, candidate: cand, applicationId: a.applicationId, interviewer };
}

describe('scheduleInterview', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates interview, emails candidate + interviewer with .ics attachments, records audit', async () => {
    const { hr, applicationId, interviewer, candidate } = await setupApp();
    __resetTransportForTests();

    const r = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/abc',
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.interview.findUniqueOrThrow({ where: { id: r.interviewId } });
    expect(created.status).toBe('SCHEDULED');
    expect(created.interviewerUserId).toBe(interviewer.id);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(2);
    const toEmails = sends.map((s) => s.to).sort();
    expect(toEmails).toEqual([candidate.email, interviewer.email].sort());
    // Both sends carry the .ics attachment
    for (const s of sends) {
      expect(s.attachments).toBeDefined();
      expect(s.attachments?.[0]).toMatchObject({
        contentType: expect.stringContaining('text/calendar'),
      });
      const filename = (s.attachments?.[0] as { filename: string }).filename;
      expect(filename).toMatch(/^interview-.+\.ics$/);
    }

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'INTERVIEW_SCHEDULED')).toBe(true);
  });

  it('returns CONFLICT when interviewer already has an overlapping slot and force is not set', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const first = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    expect(first.ok).toBe(true);

    // Schedule a second one starting 30 minutes into the first
    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('CONFLICT');
    expect(second.conflicts).toHaveLength(1);
    expect(second.conflicts[0]?.id).toBe(first.ok ? first.interviewId : '');
  });

  it('force=true bypasses the conflict check and schedules anyway', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      force: true,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(true);
  });

  it('CANCELLED interviews are ignored in conflict check', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const first = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 60,
        format: 'VIDEO', interviewerUserId: interviewer.id,
        locationOrLink: 'https://meet.example.com/a',
      },
    });
    if (!first.ok) throw new Error();
    await cancelInterview({ interviewId: first.interviewId, actorUserId: hr.id });

    const overlap = new Date(Date.now() + 7 * 86_400_000 + 30 * 60_000).toISOString();
    const second = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: overlap, durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1-555-0100',
      },
    });
    expect(second.ok).toBe(true);
  });

  it('returns NOT_FOUND when applicationId does not exist', async () => {
    const { hr, interviewer } = await setupApp();
    const r = await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId: 'nope', scheduledAt: futureIso(7), durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: 'x',
      },
    });
    expect(r).toMatchObject({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('listInterviewsForUser', () => {
  beforeEach(() => resetDb());

  it('returns interviews where user is candidate OR interviewer, future first', async () => {
    const { hr, applicationId, interviewer, candidate } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id,
      input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });

    const forCandidate = await listInterviewsForUser(candidate.id);
    expect(forCandidate).toHaveLength(1);
    expect(forCandidate[0]?.application.job.title).toBe('Software Engineer');

    const forInterviewer = await listInterviewsForUser(interviewer.id);
    expect(forInterviewer).toHaveLength(1);
  });

  it('returns empty array for an unrelated user', async () => {
    const { hr } = await setupApp();
    expect(await listInterviewsForUser(hr.id)).toEqual([]);
  });
});

describe('listInterviewsForApplication', () => {
  beforeEach(() => resetDb());

  it('returns interviews for the application ordered by scheduledAt asc', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(14), durationMinutes: 30,
        format: 'PHONE', interviewerUserId: interviewer.id, locationOrLink: '+1',
      },
    });
    await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });

    const list = await listInterviewsForApplication(applicationId);
    expect(list).toHaveLength(2);
    expect(list[0]!.scheduledAt.getTime()).toBeLessThan(list[1]!.scheduledAt.getTime());
  });
});

describe('cancelInterview', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('flips status to CANCELLED and writes audit', async () => {
    const { hr, applicationId, interviewer } = await setupApp();
    const r = await scheduleInterview({
      scheduledByUserId: hr.id, input: {
        applicationId, scheduledAt: futureIso(7), durationMinutes: 45,
        format: 'VIDEO', interviewerUserId: interviewer.id, locationOrLink: 'link',
      },
    });
    if (!r.ok) throw new Error();

    const c = await cancelInterview({ interviewId: r.interviewId, actorUserId: hr.id });
    expect(c.ok).toBe(true);

    const after = await prisma.interview.findUniqueOrThrow({ where: { id: r.interviewId } });
    expect(after.status).toBe('CANCELLED');

    const audits = await prisma.auditLog.findMany({ where: { action: 'INTERVIEW_CANCELLED' } });
    expect(audits).toHaveLength(1);
  });

  it('returns NOT_FOUND for unknown id', async () => {
    const r = await cancelInterview({ interviewId: 'nope', actorUserId: 'x' });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

`src/lib/services/interviewService.ts`:
```ts
import type { Interview, InterviewFormat } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { interviewInputSchema, type InterviewInput } from '@/lib/validation/interviews';
import { buildIcs } from '@/lib/ics/buildIcs';

export type ScheduleResult =
  | { ok: true; interviewId: string }
  | { ok: false; reason: 'INVALID' | 'NOT_FOUND' | 'INTERVIEWER_NOT_FOUND' }
  | { ok: false; reason: 'CONFLICT'; conflicts: Array<{ id: string; scheduledAt: Date; durationMinutes: number; applicationId: string }> };

const FORMAT_LABEL: Record<InterviewFormat, string> = {
  VIDEO: 'Video', PHONE: 'Phone', IN_PERSON: 'In person',
};

const LOCATION_LABEL: Record<InterviewFormat, string> = {
  VIDEO: 'Meeting link', PHONE: 'Phone', IN_PERSON: 'Location',
};

export async function scheduleInterview(args: {
  scheduledByUserId: string;
  input: InterviewInput | Record<string, unknown>;
  force?: boolean;
}): Promise<ScheduleResult> {
  const parsed = interviewInputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, reason: 'INVALID' };

  const app = await prisma.application.findUnique({
    where: { id: parsed.data.applicationId },
    include: {
      job: { select: { id: true, title: true } },
      candidate: { select: { id: true, name: true, email: true } },
    },
  });
  if (!app) return { ok: false, reason: 'NOT_FOUND' };

  const interviewer = await prisma.user.findUnique({
    where: { id: parsed.data.interviewerUserId },
  });
  if (!interviewer) return { ok: false, reason: 'INTERVIEWER_NOT_FOUND' };

  // Conflict check: any non-cancelled interview whose window overlaps ours.
  // Overlap = startA < endB AND startB < endA.
  const startA = parsed.data.scheduledAt;
  const endA = new Date(startA.getTime() + parsed.data.durationMinutes * 60_000);

  if (!args.force) {
    const candidates = await prisma.interview.findMany({
      where: {
        interviewerUserId: parsed.data.interviewerUserId,
        status: { not: 'CANCELLED' },
        // Cheap pre-filter by index: any interview whose start is within
        // (startA - 4h, endA). We refine in JS because Prisma can't do
        // start+duration arithmetic in a where clause.
        scheduledAt: {
          gte: new Date(startA.getTime() - 4 * 60 * 60_000),
          lt: endA,
        },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true, applicationId: true },
    });
    const conflicts = candidates.filter((c) => {
      const startB = c.scheduledAt;
      const endB = new Date(startB.getTime() + c.durationMinutes * 60_000);
      return startA < endB && startB < endA;
    });
    if (conflicts.length > 0) {
      return { ok: false, reason: 'CONFLICT', conflicts };
    }
  }

  const created = await prisma.interview.create({
    data: {
      applicationId: parsed.data.applicationId,
      scheduledAt: parsed.data.scheduledAt,
      durationMinutes: parsed.data.durationMinutes,
      format: parsed.data.format,
      interviewerUserId: parsed.data.interviewerUserId,
      locationOrLink: parsed.data.locationOrLink,
      notes: parsed.data.notes ?? null,
    },
  });

  await recordAudit({
    actorUserId: args.scheduledByUserId,
    action: 'INTERVIEW_SCHEDULED',
    entityType: 'Interview',
    entityId: created.id,
    metadata: { applicationId: parsed.data.applicationId, interviewerUserId: parsed.data.interviewerUserId },
  });

  // Build .ics + send emails
  const whenHuman = formatWhen(parsed.data.scheduledAt);
  const ics = buildIcs({
    uid: `${created.id}@itsnottechy.com`,
    title: `Interview: ${app.candidate.name} — ${app.job.title}`,
    description:
      `${FORMAT_LABEL[parsed.data.format]} interview.\n` +
      `${LOCATION_LABEL[parsed.data.format]}: ${parsed.data.locationOrLink}` +
      (parsed.data.notes ? `\n\nNotes: ${parsed.data.notes}` : ''),
    location: parsed.data.locationOrLink,
    start: parsed.data.scheduledAt,
    durationMinutes: parsed.data.durationMinutes,
    organizerEmail: process.env.SMTP_FROM_EMAIL ?? 'info@itsnottechy.com',
    organizerName: process.env.SMTP_FROM_NAME ?? 'ItsNotTechy HR',
  });

  const notesBlock = parsed.data.notes
    ? `<p><strong>Notes:</strong> ${escapeHtml(parsed.data.notes)}</p>`
    : '';

  const attachments = [{
    filename: `interview-${created.id}.ics`,
    content: ics,
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  }];

  // Email candidate
  await sendEmail({
    to: app.candidate.email,
    template: 'interview-scheduled',
    data: {
      recipientName: app.candidate.name,
      candidateName: app.candidate.name,
      jobTitle: app.job.title,
      whenHuman,
      durationMinutes: String(parsed.data.durationMinutes),
      formatLabel: FORMAT_LABEL[parsed.data.format],
      locationLabel: LOCATION_LABEL[parsed.data.format],
      locationOrLink: parsed.data.locationOrLink,
      notesBlock,
    },
    attachments,
  });

  // Email interviewer
  await sendEmail({
    to: interviewer.email,
    template: 'interview-scheduled',
    data: {
      recipientName: interviewer.name,
      candidateName: app.candidate.name,
      jobTitle: app.job.title,
      whenHuman,
      durationMinutes: String(parsed.data.durationMinutes),
      formatLabel: FORMAT_LABEL[parsed.data.format],
      locationLabel: LOCATION_LABEL[parsed.data.format],
      locationOrLink: parsed.data.locationOrLink,
      notesBlock,
    },
    attachments,
  });

  return { ok: true, interviewId: created.id };
}

export async function listInterviewsForUser(userId: string) {
  return prisma.interview.findMany({
    where: {
      OR: [
        { interviewerUserId: userId },
        { application: { candidateUserId: userId } },
      ],
      status: { not: 'CANCELLED' },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      application: {
        select: {
          id: true,
          candidate: { select: { id: true, name: true, email: true } },
          job: { select: { id: true, title: true } },
        },
      },
    },
  });
}

export async function listInterviewsForApplication(applicationId: string) {
  return prisma.interview.findMany({
    where: { applicationId },
    orderBy: { scheduledAt: 'asc' },
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
    },
  });
}

export type CancelResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

export async function cancelInterview(args: {
  interviewId: string;
  actorUserId: string;
}): Promise<CancelResult> {
  const claim = await prisma.interview.updateMany({
    where: { id: args.interviewId, status: 'SCHEDULED' },
    data: { status: 'CANCELLED' },
  });
  if (claim.count === 0) {
    const existing = await prisma.interview.findUnique({ where: { id: args.interviewId } });
    if (!existing) return { ok: false, reason: 'NOT_FOUND' };
    // Already in non-SCHEDULED state — treat as already-cancelled / completed.
    return { ok: true };
  }
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'INTERVIEW_CANCELLED',
    entityType: 'Interview',
    entityId: args.interviewId,
  });
  return { ok: true };
}

// --- helpers ---

function formatWhen(d: Date): string {
  // Stable UTC string. Future improvement: per-user timezone (out of scope).
  return d.toUTCString().replace(' GMT', ' UTC');
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
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm test -- src/lib/services/interviewService.test.ts
git add src/lib/services/interviewService.ts src/lib/services/interviewService.test.ts
git commit -m "feat(interviews): add interviewService with conflict detection + ics emails"
```

---

## Task 5: HR scheduling UI on application detail

**Files:**
- Create: `src/app/dashboard/hr/applications/[id]/ScheduleInterviewForm.tsx`
- Create: `src/app/dashboard/hr/applications/[id]/scheduleInterviewAction.ts`
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx` (add a new `<Card>` section)

**Behavior:**
- HR fills in date+time, duration, format, interviewer (`<select>` of all active staff users), location-or-link, notes.
- Submitting first runs the action without `force`. If service returns `CONFLICT`, the action returns the conflicts as state. The form displays them and shows a "Schedule anyway" button. Clicking it re-submits with a hidden `force=1` input.
- On success, the page revalidates and shows the new interview in the list (built in Task 7).

- [ ] **Step 1: Create the action**

`src/app/dashboard/hr/applications/[id]/scheduleInterviewAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { scheduleInterview } from '@/lib/services/interviewService';

export type ScheduleFormState =
  | { ok: true }
  | { error?: string; conflicts?: { id: string; scheduledAt: string; durationMinutes: number }[] }
  | Record<string, never>;

export async function scheduleInterviewAction(
  _prev: ScheduleFormState | undefined,
  fd: FormData,
): Promise<ScheduleFormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const applicationId = String(fd.get('applicationId') ?? '');

  const r = await scheduleInterview({
    scheduledByUserId: user.id,
    force: fd.get('force') === '1',
    input: {
      applicationId,
      scheduledAt: String(fd.get('scheduledAt') ?? ''),
      durationMinutes: Number(fd.get('durationMinutes') ?? 45),
      format: String(fd.get('format') ?? 'VIDEO') as 'VIDEO' | 'PHONE' | 'IN_PERSON',
      interviewerUserId: String(fd.get('interviewerUserId') ?? ''),
      locationOrLink: String(fd.get('locationOrLink') ?? ''),
      notes: (fd.get('notes') as string | null) || undefined,
    },
  });

  if (!r.ok) {
    if (r.reason === 'CONFLICT') {
      return {
        conflicts: r.conflicts.map((c) => ({
          id: c.id, scheduledAt: c.scheduledAt.toISOString(), durationMinutes: c.durationMinutes,
        })),
        error: 'This interviewer already has an interview that overlaps. You can schedule anyway, or choose a different time.',
      };
    }
    return {
      error:
        r.reason === 'INVALID'                  ? 'Some fields are missing or invalid.' :
        r.reason === 'NOT_FOUND'                ? 'Application no longer exists.' :
        r.reason === 'INTERVIEWER_NOT_FOUND'    ? 'Selected interviewer does not exist.' :
                                                  'Could not schedule this interview.',
    };
  }
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Create the client form**

`src/app/dashboard/hr/applications/[id]/ScheduleInterviewForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { scheduleInterviewAction, type ScheduleFormState } from './scheduleInterviewAction';

type Staff = { id: string; name: string; email: string };

export function ScheduleInterviewForm({
  applicationId,
  staffUsers,
}: {
  applicationId: string;
  staffUsers: Staff[];
}) {
  const [state, formAction] = useFormState(scheduleInterviewAction, {} as ScheduleFormState);
  const [force, setForce] = useState(false);

  // Once a success state arrives, briefly show success; the page revalidates so
  // the new row appears in the list above.
  const ok = 'ok' in state && state.ok === true;
  const error = 'error' in state ? state.error : undefined;
  const conflicts = 'conflicts' in state ? state.conflicts : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      {force && <input type="hidden" name="force" value="1" />}

      {ok && <Alert tone="success">Interview scheduled. Emails are out.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {conflicts && conflicts.length > 0 && (
        <Alert tone="warning">
          <div className="font-medium">Conflicting interviews:</div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {conflicts.map((c) => (
              <li key={c.id}>
                {new Date(c.scheduledAt).toUTCString()} · {c.durationMinutes} min
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="scheduledAt">When (your local time)</Label>
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={15} max={240} defaultValue={45} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="format">Format</Label>
          <select id="format" name="format" required defaultValue="VIDEO"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="VIDEO">Video</option>
            <option value="PHONE">Phone</option>
            <option value="IN_PERSON">In person</option>
          </select>
        </div>
        <div>
          <Label htmlFor="interviewerUserId">Interviewer</Label>
          <select id="interviewerUserId" name="interviewerUserId" required
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="locationOrLink">Location or meeting link</Label>
          <Input id="locationOrLink" name="locationOrLink" required placeholder="https://meet.example.com/abc OR 123 Main St"
                 className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <textarea id="notes" name="notes" rows={3}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" onClick={() => setForce(false)}>
          {conflicts && conflicts.length > 0 ? 'Re-check' : 'Schedule interview'}
        </Button>
        {conflicts && conflicts.length > 0 && (
          <Button type="submit" onClick={() => setForce(true)} variant="secondary">
            Schedule anyway
          </Button>
        )}
      </div>
    </form>
  );
}
```

**NOTE:** If `Button` does not currently accept a `variant="secondary"` prop, the implementer should either (a) add the variant to `src/components/ui/Button.tsx` (one extra Tailwind class string), or (b) use a plain `<button>` for the "Schedule anyway" action with slate styling. Check `src/components/ui/Button.tsx` first.

- [ ] **Step 3: Modify the application detail page to render the form**

In `src/app/dashboard/hr/applications/[id]/page.tsx`, add a new `<Card>` section between the "Application" card and the "Internal notes" card.

First, add imports at the top:
```tsx
import { prisma } from '@/lib/prisma';
import { ScheduleInterviewForm } from './ScheduleInterviewForm';
import { listInterviewsForApplication } from '@/lib/services/interviewService';
```

In the body of the component, after the `const app = await getApplicationForHr(...)` block, add:
```tsx
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] }, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  const interviews = await listInterviewsForApplication(params.id);
```

Then, between the Application card and the Internal notes card, insert:
```tsx
      <Card>
        <CardTitle>Interviews ({interviews.length})</CardTitle>
        {interviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No interviews scheduled yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {interviews.map((iv) => (
              <li key={iv.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium text-slate-800">
                  {iv.scheduledAt.toUTCString()}
                  {' '}· {iv.durationMinutes} min · {iv.format.replace('_', ' ').toLowerCase()}
                  {iv.status !== 'SCHEDULED' && (
                    <span className="ml-2 text-xs text-slate-500">({iv.status.toLowerCase()})</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Interviewer: {iv.interviewer.name} · {iv.locationOrLink}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Schedule a new interview</h3>
          <div className="mt-3">
            <ScheduleInterviewForm applicationId={params.id} staffUsers={staffUsers} />
          </div>
        </div>
      </Card>
```

- [ ] **Step 4: Build + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build
git add "src/app/dashboard/hr/applications/[id]/"
git commit -m "feat(interviews): HR scheduling form with conflict warning"
```

---

## Task 6: "My Interviews" widget on relevant dashboards

**Files:**
- Create: `src/components/MyInterviewsWidget.tsx`
- Modify: `src/app/dashboard/hr/page.tsx`, `src/app/dashboard/manager/page.tsx`, `src/app/dashboard/employee/page.tsx`, `src/app/dashboard/candidate/page.tsx`

The widget is a server component that takes a `userId`, calls `listInterviewsForUser`, and renders a small `<Card>` with up to the next 5 interviews.

- [ ] **Step 1: Create the widget**

`src/components/MyInterviewsWidget.tsx`:
```tsx
import Link from 'next/link';
import { listInterviewsForUser } from '@/lib/services/interviewService';
import { Card, CardTitle } from '@/components/ui/Card';

export async function MyInterviewsWidget({ userId }: { userId: string }) {
  const all = await listInterviewsForUser(userId);
  const upcoming = all.filter((iv) => iv.scheduledAt.getTime() > Date.now()).slice(0, 5);

  return (
    <Card>
      <CardTitle>Upcoming interviews</CardTitle>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No interviews scheduled.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {upcoming.map((iv) => (
            <li key={iv.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <div className="font-medium text-slate-800">
                {iv.scheduledAt.toUTCString()} · {iv.durationMinutes} min
              </div>
              <div className="text-xs text-slate-500">
                {iv.application.candidate.name} → {iv.application.job.title}
                {' '}({iv.format.replace('_', ' ').toLowerCase()})
              </div>
              <div className="mt-1 text-xs">
                <Link
                  href={`/dashboard/hr/applications/${iv.application.id}`}
                  className="text-brand-600 hover:underline"
                >
                  Open application
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

**NOTE on the "Open application" link**: HR/MANAGER can hit `/dashboard/hr/applications/[id]`; EMPLOYEE cannot (rbac will redirect). For the EMPLOYEE/CANDIDATE case, the link target is wrong — but they shouldn't be appearing as interviewers very often, and CANDIDATE has `/dashboard/candidate/applications/[id]` (already exists from Phase 2). To keep this simple in v1, omit the link for EMPLOYEE/CANDIDATE by passing an optional `canSeeApplication: boolean` prop, defaulting to false:

Adjust signature:
```tsx
export async function MyInterviewsWidget({
  userId, canSeeHrApplication = false,
}: { userId: string; canSeeHrApplication?: boolean }) {
```

And gate the link:
```tsx
{canSeeHrApplication && (
  <div className="mt-1 text-xs">
    <Link href={`/dashboard/hr/applications/${iv.application.id}`} className="text-brand-600 hover:underline">
      Open application
    </Link>
  </div>
)}
```

Pass `canSeeHrApplication={true}` from the HR and Manager dashboards; default (false) from Employee and Candidate.

- [ ] **Step 2: Embed on HR dashboard**

In `src/app/dashboard/hr/page.tsx`, add to the existing layout:
```tsx
import { MyInterviewsWidget } from '@/components/MyInterviewsWidget';

// inside the component (after getSessionUser/requireAnyRole)
<MyInterviewsWidget userId={user.id} canSeeHrApplication />
```

(Place it as one card among the existing dashboard cards.)

- [ ] **Step 3: Embed on Manager dashboard**

In `src/app/dashboard/manager/page.tsx`, same import + same `<MyInterviewsWidget userId={user.id} canSeeHrApplication />`.

- [ ] **Step 4: Embed on Employee dashboard**

In `src/app/dashboard/employee/page.tsx`, add a third card to the grid:
```tsx
<MyInterviewsWidget userId={user.id} />
```

- [ ] **Step 5: Embed on Candidate dashboard**

In `src/app/dashboard/candidate/page.tsx`, add the widget. If the existing layout has a left/right split, place it on the right; otherwise add it as a new section above or below the application list. Check the file before editing.

- [ ] **Step 6: Build + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build
git add src/components/MyInterviewsWidget.tsx src/app/dashboard/
git commit -m "feat(interviews): MyInterviews widget on HR/manager/employee/candidate dashboards"
```

---

## Task 7: Cancel-interview UI on HR application detail

**Files:**
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx` (extend the interview list row with a cancel button)
- Create: `src/app/dashboard/hr/applications/[id]/cancelInterviewAction.ts`

- [ ] **Step 1: Create the action**

`src/app/dashboard/hr/applications/[id]/cancelInterviewAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { cancelInterview } from '@/lib/services/interviewService';

export async function cancelInterviewAction(fd: FormData): Promise<void> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const interviewId = String(fd.get('interviewId') ?? '');
  const applicationId = String(fd.get('applicationId') ?? '');
  if (!interviewId || !applicationId) return;
  await cancelInterview({ interviewId, actorUserId: user.id });
  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
}
```

- [ ] **Step 2: Add cancel button to the interview list**

In the interview list within `src/app/dashboard/hr/applications/[id]/page.tsx`, extend each `<li>` to include a small cancel form (only when `iv.status === 'SCHEDULED'`):
```tsx
<li key={iv.id} className="flex items-start justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
  <div>
    <div className="font-medium text-slate-800">
      {iv.scheduledAt.toUTCString()}
      {' '}· {iv.durationMinutes} min · {iv.format.replace('_', ' ').toLowerCase()}
      {iv.status !== 'SCHEDULED' && (
        <span className="ml-2 text-xs text-slate-500">({iv.status.toLowerCase()})</span>
      )}
    </div>
    <div className="text-xs text-slate-500">
      Interviewer: {iv.interviewer.name} · {iv.locationOrLink}
    </div>
  </div>
  {iv.status === 'SCHEDULED' && (
    <form action={cancelInterviewAction}>
      <input type="hidden" name="interviewId" value={iv.id} />
      <input type="hidden" name="applicationId" value={params.id} />
      <button type="submit" className="text-xs text-red-600 hover:underline">Cancel</button>
    </form>
  )}
</li>
```

Add the import at the top:
```tsx
import { cancelInterviewAction } from './cancelInterviewAction';
```

- [ ] **Step 3: Build + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build
git add "src/app/dashboard/hr/applications/[id]/"
git commit -m "feat(interviews): cancel-interview button on HR application detail"
```

---

## Task 8: Phase 5 sweep + final review + tag + merge

- [ ] **Step 1: Full sweep**

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" && \
  npm test && \
  npx tsc --noEmit && \
  npm run lint && \
  npm run build
```

All four must be green. Tests should land around 190 (173 + ~17 new across validation + ics + service).

- [ ] **Step 2: Dispatch final opus code review**

Scope: commits from `phase-4-complete` to `HEAD` of branch `phase-5-interviews`. Spec is `docs/superpowers/specs/2026-05-17-itsnottechy-careers-design.md` section 8.3 and capability matrix rows on interviews.

- [ ] **Step 3: Fix anything substantive**

Apply review-driven fixes as separate commits before tagging.

- [ ] **Step 4: Tag + ff-merge to main**

```bash
git tag phase-5-complete
git checkout main
git merge --ff-only phase-5-interviews
git checkout phase-5-interviews
```

---

## End-of-plan state

- Full interview lifecycle: HR schedules → conflict warning → force or pick a different time → candidate + interviewer get `.ics`-attached emails → both see it on their dashboards → HR can cancel
- 1 new email template (`interview-scheduled`) with `.ics` attachment via existing `sendEmail` attachments support
- "My Interviews" widget on 4 dashboards (HR, Manager, Employee, Candidate)
- ~190 tests passing

## Out of scope (defer to later phases / v2)

- Reschedule (delete-and-recreate works as a workaround)
- Mark as COMPLETED / NO_SHOW from the UI
- Cancellation email
- Per-user timezone (everything is UTC for now)
- Scorecards / structured feedback
- Multi-interviewer / panel format
- Calendar sync with Google/Outlook beyond the .ics attachment
