import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmailTemplateForm } from '../EmailTemplateForm';
import { createTemplateAction } from '../actions';

export default async function NewEmailTemplatePage() {
  requireRole(await getSessionUser(), 'SUPER_ADMIN');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New email template</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <EmailTemplateForm
            defaults={{ name: '', subject: '', body: '' }}
            action={createTemplateAction}
            submitLabel="Create template"
          />
        </div>
      </Card>
    </div>
  );
}
