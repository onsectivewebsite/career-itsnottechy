import Link from 'next/link';
import { listInterviewsForUser } from '@/lib/services/interviewService';
import { Card, CardTitle } from '@/components/ui/Card';

export async function MyInterviewsWidget({
  userId,
  canSeeHrApplication = false,
}: {
  userId: string;
  canSeeHrApplication?: boolean;
}) {
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
              {canSeeHrApplication && (
                <div className="mt-1 text-xs">
                  <Link
                    href={`/dashboard/hr/applications/${iv.application.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    Open application
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
