import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { MyInterviewsWidget } from '@/components/MyInterviewsWidget';

export default async function ManagerDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Promotion inbox</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/dashboard/manager/promotions" className="text-brand-600 hover:underline">
              View requests from your direct reports
            </Link>
          </p>
        </Card>
        <MyInterviewsWidget userId={user.id} />
      </div>
    </div>
  );
}
