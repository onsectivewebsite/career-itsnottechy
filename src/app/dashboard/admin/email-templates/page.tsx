import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { listTemplates } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function EmailTemplatesPage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const templates = await listTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Email templates</h1>
        <Link href="/dashboard/admin/email-templates/new"><Button>+ New template</Button></Link>
      </div>

      <Card>
        <CardTitle>All templates</CardTitle>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No templates yet. Create one to get started.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/dashboard/admin/email-templates/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {t.name}
                  </Link>
                  <div className="text-sm text-slate-500">{t.subject}</div>
                </div>
                <div className="text-xs text-slate-500">Updated {t.updatedAt.toISOString().slice(0, 10)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
