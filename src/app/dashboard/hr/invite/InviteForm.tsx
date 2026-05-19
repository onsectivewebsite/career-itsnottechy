'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { inviteStaffAction } from './actions';

type FormState = { error?: string; fieldErrors?: Record<string, string[]> };
type Mgr = { id: string; name: string };

export function InviteForm({ managers }: { managers: Mgr[] }) {
  const [state, formAction] = useFormState(inviteStaffAction, {} as FormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" />
          {state.fieldErrors?.email && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>}
        </div>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" required defaultValue="EMPLOYEE"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="HR_MANAGER">HR Manager</option>
          </select>
        </div>
        <div>
          <Label htmlFor="employeeCode">Employee code</Label>
          <Input id="employeeCode" name="employeeCode" required className="mt-1" placeholder="e.g., E2026-0042" />
          {state.fieldErrors?.employeeCode && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.employeeCode[0]}</p>}
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="hireDate">Hire date</Label>
          <Input id="hireDate" name="hireDate" type="date" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="managerEmployeeId">Manager (optional)</Label>
          <select id="managerEmployeeId" name="managerEmployeeId"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">No manager</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <Button type="submit">Send invitation</Button>
    </form>
  );
}
