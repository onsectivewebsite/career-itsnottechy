import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { getApplicationForHr } from '@/lib/services/atsService';
import { STAGE_LABEL, STAGE_TONE } from '@/lib/ats/stages';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StageActions } from './StageActions';
import { NoteForm } from './NoteForm';
import type { CustomQuestion } from '@/types/customQuestions';
import { prisma } from '@/lib/prisma';
import { ScheduleInterviewForm } from './ScheduleInterviewForm';
import { listInterviewsForApplication } from '@/lib/services/interviewService';
import { cancelInterviewAction } from './cancelInterviewAction';
import { listApplicationDocuments } from '@/lib/services/documentService';
import { RequestDocumentForm } from './RequestDocumentForm';

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const app = await getApplicationForHr(params.id);
  if (!app) notFound();

  const questions = (app.job.customQuestions as unknown as CustomQuestion[]) ?? [];
  const answers = (app.customAnswers as Record<string, string>) ?? {};

  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] }, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  const interviews = await listInterviewsForApplication(params.id);
  const documents = await listApplicationDocuments(params.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/hr/jobs/${app.job.id}/applicants`} className="text-sm text-brand-600 hover:underline">
          &larr; Back to applicants
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{app.candidate.name}</h1>
            <p className="text-sm text-slate-500">{app.candidate.email}</p>
            <p className="text-sm text-slate-500">Applied for {app.job.title} &middot; {app.createdAt.toISOString().slice(0, 10)}</p>
          </div>
          <div className="flex items-center gap-2">
            {app.referral && (
              <Badge tone="blue">Referred by {app.referral.referringUser.name}</Badge>
            )}
            <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardTitle>Stage</CardTitle>
        <div className="mt-3">
          <StageActions applicationId={app.id} jobId={app.job.id} currentStage={app.stage} />
        </div>
      </Card>

      <Card>
        <CardTitle>Application</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-32 text-slate-500">Resume</dt>
            <dd>
              <a className="text-brand-600 hover:underline" href={`/api/files/${app.resumeUrl}`} target="_blank" rel="noreferrer">
                Download
              </a>
            </dd>
          </div>
          {app.coverLetter && (
            <div className="flex gap-2">
              <dt className="w-32 text-slate-500">Cover letter</dt>
              <dd className="whitespace-pre-wrap">{app.coverLetter}</dd>
            </div>
          )}
        </dl>
        {questions.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-slate-700">Answers</h3>
            <dl className="mt-2 space-y-2 text-sm">
              {questions.map((q) => (
                <div key={q.id} className="flex gap-2">
                  <dt className="w-48 text-slate-500">{q.label}</dt>
                  <dd className="text-slate-800">{answers[q.id] ?? <span className="text-slate-400">&mdash;</span>}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Interviews ({interviews.length})</CardTitle>
        {interviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No interviews scheduled yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {interviews.map((iv) => (
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

      <Card>
        <CardTitle>Internal notes ({app.notes.length})</CardTitle>
        <div className="mt-3 space-y-3">
          {app.notes.map((note) => (
            <div key={note.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">
                {note.author.name} &middot; {note.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{note.body}</p>
            </div>
          ))}
          {app.notes.length === 0 && (
            <p className="text-sm text-slate-500">No notes yet.</p>
          )}
        </div>
        <div className="mt-4">
          <NoteForm applicationId={app.id} />
        </div>
      </Card>

      <Card>
        <CardTitle>Documents</CardTitle>
        <div className="mt-3 space-y-2">
          {documents.length === 0 && (
            <p className="text-sm text-slate-500">No documents for this application yet.</p>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                {doc.instructions && <p className="text-xs text-slate-500">{doc.instructions}</p>}
              </div>
              {doc.status === 'SUBMITTED' && doc.fileUrl ? (
                <a
                  href={`/api/files/${doc.fileUrl}`}
                  className="text-sm text-brand-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              ) : (
                <Badge tone="amber">Awaiting upload</Badge>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-900">Request a document</p>
          <div className="mt-2">
            <RequestDocumentForm applicationId={params.id} />
          </div>
        </div>
      </Card>
    </div>
  );
}
