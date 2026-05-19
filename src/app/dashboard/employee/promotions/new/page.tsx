import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { PromotionForm } from './PromotionForm';

export const metadata = { title: 'Request a promotion · ItsNotTechy Careers' };

export default async function NewPromotionPage() {
  const user = requireAnyRole(await getSessionUser(), ['MANAGER', 'EMPLOYEE']);
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { title: true, managerId: true },
  });

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
        <Alert tone="error">Your account is missing an employee record. Please contact HR.</Alert>
      </div>
    );
  }

  if (!employee.managerId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
        <Alert tone="warning">
          You don&apos;t have a manager assigned yet. Ask HR to set one before submitting a request.
        </Alert>
        <Link href="/dashboard/employee/promotions" className="text-sm text-brand-600 hover:underline">
          &larr; Back to my promotions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/employee/promotions" className="text-sm text-brand-600 hover:underline">
        &larr; Back to my promotions
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Request a promotion</h1>
      <Card>
        <CardTitle>About this request</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Your manager will review first; if approved, HR will make the final decision.
          You&apos;ll receive an email at each step.
        </p>
        <div className="mt-4">
          <PromotionForm defaultCurrentTitle={employee.title} />
        </div>
      </Card>
    </div>
  );
}
