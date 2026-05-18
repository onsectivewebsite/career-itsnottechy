import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { JobForm } from '@/components/jobs/JobForm';
import { createJobAction } from '../actions';

export default async function NewJobPage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New job posting</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <JobForm action={createJobAction} submitLabel="Create draft" />
        </div>
      </Card>
    </div>
  );
}
