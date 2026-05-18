import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { listJobsForHr } from '@/lib/services/jobService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default async function HrJobsPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const jobs = await listJobsForHr();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Job postings</h1>
        <Link href="/dashboard/hr/jobs/new"><Button>New job</Button></Link>
      </div>
      <Card>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-600">No jobs yet. Create your first posting.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/hr/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {job.title}
                  </Link>
                  <div className="text-sm text-slate-500">
                    {job.department} · {job.locationType.toLowerCase()} · {job._count.applications} applications
                  </div>
                </div>
                <Badge tone={job.status === 'OPEN' ? 'green' : job.status === 'DRAFT' ? 'neutral' : 'amber'}>
                  {job.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
