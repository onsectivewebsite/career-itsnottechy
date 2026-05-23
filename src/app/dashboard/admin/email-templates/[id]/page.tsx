import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { getTemplate } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmailTemplateForm } from '../EmailTemplateForm';
import { updateTemplateAction, deleteTemplateAction } from '../actions';

export default async function EditEmailTemplatePage({ params }: { params: { id: string } }) {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const template = await getTemplate(params.id);
  if (!template) notFound();

  const boundUpdate = updateTemplateAction.bind(null, params.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/email-templates" className="text-sm text-brand-600 hover:underline">&larr; All templates</Link>
      <h1 className="text-2xl font-bold text-slate-900">{template.name}</h1>

      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <EmailTemplateForm
            defaults={{ name: template.name, subject: template.subject, body: template.body }}
            action={boundUpdate}
            submitLabel="Save changes"
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Danger zone</CardTitle>
        <form action={deleteTemplateAction.bind(null, params.id)} className="mt-3">
          <p className="text-sm text-slate-600">
            Deleting this template can&apos;t be undone. Existing emails already sent are unaffected.
          </p>
          <div className="mt-3">
            <Button type="submit" variant="danger">Delete template</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
