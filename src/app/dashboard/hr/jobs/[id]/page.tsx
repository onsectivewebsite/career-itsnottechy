import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { JobForm } from '@/components/jobs/JobForm';
import { updateJobAction, publishJobAction, closeJobAction } from '../actions';
import type { CustomQuestion } from '@/types/customQuestions';

export default async function EditJobPage({ params }: { params: { id: string } }) {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  const updateBoundAction = updateJobAction.bind(null, job.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
        <Badge tone={job.status === 'OPEN' ? 'green' : job.status === 'DRAFT' ? 'neutral' : 'amber'}>
          {job.status}
        </Badge>
      </div>

      <Card>
        <CardTitle>Status</CardTitle>
        <div className="mt-3 flex gap-2">
          {job.status !== 'OPEN' && (
            <form action={publishJobAction.bind(null, job.id)}>
              <button className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                Publish
              </button>
            </form>
          )}
          {job.status !== 'CLOSED' && (
            <form action={closeJobAction.bind(null, job.id)}>
              <button className="rounded-md bg-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-300">
                Close
              </button>
            </form>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Edit</CardTitle>
        <div className="mt-4">
          <JobForm
            defaults={{
              title: job.title,
              department: job.department,
              locationType: job.locationType,
              locationCity: job.locationCity ?? '',
              type: job.type,
              description: job.description,
              requirements: job.requirements,
              salaryMin: job.salaryMin?.toString() ?? '',
              salaryMax: job.salaryMax?.toString() ?? '',
              currency: job.currency,
              deadline: job.deadline ? job.deadline.toISOString().slice(0, 10) : '',
              customQuestions: (job.customQuestions as unknown as CustomQuestion[]) ?? [],
            }}
            action={updateBoundAction}
            submitLabel="Save changes"
          />
        </div>
      </Card>
    </div>
  );
}
