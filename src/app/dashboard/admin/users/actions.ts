'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { setUserRole, setUserActive } from '@/lib/services/adminUserService';
import type { Role } from '@prisma/client';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'CANDIDATE'];

export async function changeRoleAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const newRole = String(fd.get('newRole') ?? '');
  if (!ROLES.includes(newRole as Role)) return;
  await setUserRole({ userId, newRole: newRole as Role, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
}

export async function toggleActiveAction(fd: FormData): Promise<void> {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const active = fd.get('active') === '1';
  await setUserActive({ userId, active, actorUserId: user.id });
  revalidatePath('/dashboard/admin/users');
}
