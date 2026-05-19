import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { MyInterviewsWidget } from '@/components/MyInterviewsWidget';

export default async function EmployeeDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Refer a candidate</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Available in Phase 4.</p>
        </Card>
        <Card>
          <CardTitle>Promotions</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/employee/promotions" className="text-brand-600 hover:underline">
              My promotion requests
            </Link>
          </p>
        </Card>
        <MyInterviewsWidget userId={user.id} />
      </div>
    </div>
  );
}
