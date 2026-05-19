import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true, email: true, name: true, role: true, isActive: true, createdAt: true,
      employee: { select: { employeeCode: true, department: true, title: true } },
    },
  });
}

export type SetRoleResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'LAST_ADMIN' | 'NO_EMPLOYEE_RECORD' };

export async function setUserRole(args: {
  userId: string; newRole: Role; actorUserId: string;
}): Promise<SetRoleResult> {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true, role: true, employee: { select: { id: true } } },
  });
  if (!user) return { ok: false, reason: 'NOT_FOUND' };

  // Refuse to demote the last remaining active SUPER_ADMIN.
  if (user.role === 'SUPER_ADMIN' && args.newRole !== 'SUPER_ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (admins <= 1) return { ok: false, reason: 'LAST_ADMIN' };
  }

  // Refuse to promote a user without an Employee row to a role that needs one.
  // Spec note: Employee row required for HR_MANAGER / MANAGER / EMPLOYEE.
  // SUPER_ADMIN and CANDIDATE legitimately have no Employee row.
  const STAFF_ROLES: Role[] = ['HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
  if (STAFF_ROLES.includes(args.newRole) && !user.employee) {
    return { ok: false, reason: 'NO_EMPLOYEE_RECORD' };
  }

  await prisma.user.update({ where: { id: args.userId }, data: { role: args.newRole } });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: args.userId,
    metadata: { from: user.role, to: args.newRole },
  });
  return { ok: true };
}

export type SetActiveResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'LAST_ADMIN' | 'SELF' };

export async function setUserActive(args: {
  userId: string; active: boolean; actorUserId: string;
}): Promise<SetActiveResult> {
  if (args.userId === args.actorUserId && args.active === false) {
    return { ok: false, reason: 'SELF' };
  }
  const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { role: true, isActive: true } });
  if (!user) return { ok: false, reason: 'NOT_FOUND' };

  if (!args.active && user.role === 'SUPER_ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (admins <= 1) return { ok: false, reason: 'LAST_ADMIN' };
  }

  await prisma.user.update({ where: { id: args.userId }, data: { isActive: args.active } });
  await recordAudit({
    actorUserId: args.actorUserId,
    action: args.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: args.userId,
  });
  return { ok: true };
}
