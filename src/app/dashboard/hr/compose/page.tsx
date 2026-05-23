import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { listJobsForHr } from '@/lib/services/jobService';
import { listTemplates } from '@/lib/services/emailTemplateService';
import { Card, CardTitle } from '@/components/ui/Card';
import { ComposeForm } from './ComposeForm';

export default async function ComposePage() {
  requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const [candidates, jobs, templates] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CANDIDATE', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    listJobsForHr(),
    listTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Compose email</h1>
      <Card>
        <CardTitle>To a candidate</CardTitle>
        <p className="mt-1 text-sm text-slate-600">Pick a candidate, optionally a role, then a template.</p>
        <div className="mt-4">
          <ComposeForm
            candidates={candidates}
            jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
            templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
            appUrl={process.env.APP_URL ?? ''}
          />
        </div>
      </Card>
    </div>
  );
}
