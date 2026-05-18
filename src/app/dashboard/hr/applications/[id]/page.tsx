import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { getApplicationForHr } from '@/lib/services/atsService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StageActions } from './StageActions';
import { NoteForm } from './NoteForm';
import type { CustomQuestion } from '@/types/customQuestions';

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
  OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected',
};
const STAGE_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED: 'neutral', SCREENING: 'blue', INTERVIEW: 'blue',
  OFFER: 'amber', HIRED: 'green', REJECTED: 'red',
};

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const app = await getApplicationForHr(params.id);
  if (!app) notFound();

  const questions = (app.job.customQuestions as unknown as CustomQuestion[]) ?? [];
  const answers = (app.customAnswers as Record<string, string>) ?? {};

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
            {app.referral && <Badge tone="blue">Referred</Badge>}
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
    </div>
  );
}
