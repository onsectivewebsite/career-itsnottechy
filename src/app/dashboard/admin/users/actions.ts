'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { setUserRole, setUserActive } from '@/lib/services/adminUserService';
import type { Role } from '@prisma/client';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'CANDIDATE'];

export async function changeRoleAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const newRole = String(fd.get('newRole') ?? '');
  if (!ROLES.includes(newRole as Role)) {
    redirect('/dashboard/admin/users?err=invalid');
  }
  const r = await setUserRole({ userId, newRole: newRole as Role, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
  if (!r.ok) {
    redirect(`/dashboard/admin/users?err=${r.reason.toLowerCase()}`);
  }
}

export async function toggleActiveAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const active = fd.get('active') === '1';
  const r = await setUserActive({ userId, active, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
  if (!r.ok) {
    redirect(`/dashboard/admin/users?err=${r.reason.toLowerCase()}`);
  }
}
