import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function CandidateDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'CANDIDATE']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <Card>
        <CardTitle>My applications</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Your applications will appear here once you apply to a role.
          The application flow lands in Phase 2.
        </p>
      </Card>
    </div>
  );
}
