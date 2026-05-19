'use client';

import type { Role } from '@prisma/client';
import { changeRoleAction, toggleActiveAction } from './actions';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'CANDIDATE'];

export function UserRowActions({
  userId, role, isActive,
}: { userId: string; role: Role; isActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <form action={changeRoleAction}>
        <input type="hidden" name="userId" value={userId} />
        <select name="newRole" defaultValue={role}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </form>
      <form action={toggleActiveAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="active" value={isActive ? '0' : '1'} />
        <button className={`rounded-md px-2 py-1 text-xs ${isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
          {isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </form>
    </div>
  );
}
