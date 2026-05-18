import type { InterviewFormat } from '@prisma/client';
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

  const startA = parsed.data.scheduledAt;
  const endA = new Date(startA.getTime() + parsed.data.durationMinutes * 60_000);

  if (!args.force) {
    // Pre-filter by index, refine overlap in JS (Prisma can't do start+duration arithmetic).
    // Safety window: 4h back (max interview = 240 min = 4h), so any interview that started
    // up to 4h before startA could still be running at startA.
    const candidates = await prisma.interview.findMany({
      where: {
        interviewerUserId: parsed.data.interviewerUserId,
        status: { not: 'CANCELLED' },
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

function formatWhen(d: Date): string {
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
