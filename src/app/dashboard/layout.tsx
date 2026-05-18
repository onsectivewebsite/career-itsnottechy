import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { DashboardShell } from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <DashboardShell userName={user.name} role={user.role}>{children}</DashboardShell>;
}
