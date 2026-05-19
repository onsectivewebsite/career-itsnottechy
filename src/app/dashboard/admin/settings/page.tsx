import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { getSettings } from '@/lib/services/systemSettings';
import { Card, CardTitle } from '@/components/ui/Card';
import { SettingsForm } from './SettingsForm';

export const metadata = { title: 'System settings · ItsNotTechy Careers' };

export default async function SettingsPage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin" className="text-sm text-brand-600 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold text-slate-900">System settings</h1>
      <Card>
        <CardTitle>Branding + email</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Changes take effect on the next email send. The 30-second read cache means existing in-flight sends use the old value.
        </p>
        <div className="mt-4">
          <SettingsForm initial={settings} />
        </div>
      </Card>
    </div>
  );
}
