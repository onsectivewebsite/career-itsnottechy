import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listMyApplications } from '@/lib/services/applicationService';
import { listPendingDocumentsForCandidate } from '@/lib/services/documentService';
import { listSavedJobs } from '@/lib/services/savedJobService';
import { Card, CardTitle } from '@/components/ui/Card';
import { PendingDocumentUpload } from '@/components/documents/PendingDocumentUpload';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { MyInterviewsWidget } from '@/components/MyInterviewsWidget';

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Not moving forward',
};

const STAGE_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  APPLIED:   'neutral',
  SCREENING: 'blue',
  INTERVIEW: 'blue',
  OFFER:     'amber',
  HIRED:     'green',
  REJECTED:  'red',
};

export default async function CandidateDashboard({
  searchParams,
}: {
  searchParams: { applied?: string };
}) {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'CANDIDATE']);
  const apps = await listMyApplications(user.id);
  const pendingDocuments = await listPendingDocumentsForCandidate(user.id);
  const savedJobs = await listSavedJobs(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>

      {searchParams.applied === '1' && (
        <Alert tone="success">
          Application submitted. We&apos;ll email you as your application moves through review.
        </Alert>
      )}

      {pendingDocuments.length > 0 && (
        <Card>
          <CardTitle>Documents requested</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            HR has asked you to upload the following. Your applications keep moving once they are submitted.
          </p>
          <div className="mt-4 space-y-3">
            {pendingDocuments.map((doc) => (
              <PendingDocumentUpload
                key={doc.id}
                documentId={doc.id}
                label={doc.label}
                instructions={doc.instructions}
                jobTitle={doc.application.job.title}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>My applications</CardTitle>
        {apps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t applied to any roles yet.{' '}
            <Link href="/jobs" className="font-medium text-brand-600 hover:underline">
              Browse open roles
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/jobs/${app.job.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {app.job.title}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {app.job.department} · Applied {app.createdAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <Badge tone={STAGE_TONE[app.stage]}>{STAGE_LABEL[app.stage]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Saved jobs</CardTitle>
        {savedJobs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t saved any roles yet.{' '}
            <Link href="/jobs" className="font-medium text-brand-600 hover:underline">
              Browse open roles
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {savedJobs.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/jobs/${s.job.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {s.job.title}
                  </Link>
                  <div className="text-sm text-slate-500">{s.job.department}</div>
                </div>
                <Badge tone={s.job.status === 'OPEN' ? 'green' : 'neutral'}>
                  {s.job.status === 'OPEN' ? 'Open' : 'Closed'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MyInterviewsWidget userId={user.id} />
    </div>
  );
}
