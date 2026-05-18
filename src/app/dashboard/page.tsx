import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/rbac';

export default async function DashboardIndex() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect(dashboardPathForRole(user.role));
}
