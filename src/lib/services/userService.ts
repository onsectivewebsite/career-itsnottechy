import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import type { Role } from '@prisma/client';
import { issueInviteToken, consumeInviteToken, consumePasswordResetToken, issuePasswordResetToken } from '@/lib/tokens';

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'EMAIL_TAKEN' };

export async function registerCandidate(input: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterResult> {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: 'EMAIL_TAKEN' };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      role: 'CANDIDATE',
      candidateProfile: { create: {} },
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: 'CANDIDATE' },
  });

  await sendEmail({
    to: user.email,
    template: 'welcome-candidate',
    data: {
      name: user.name,
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, userId: user.id };
}

const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  HR_MANAGER:  'HR Manager',
  MANAGER:     'Manager',
  EMPLOYEE:    'Employee',
  CANDIDATE:   'Candidate',
};

export type InviteStaffResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'EMAIL_TAKEN' | 'EMPLOYEE_CODE_TAKEN' };

export async function inviteStaff(input: {
  email: string;
  name: string;
  role: Extract<Role, 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE'>;
  employeeData: {
    employeeCode: string;
    department: string;
    title: string;
    hireDate: Date;
    managerId: string | null;
  };
  invitedByUserId: string;
}): Promise<InviteStaffResult> {
  const email = input.email.toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, reason: 'EMAIL_TAKEN' };
  }
  if (await prisma.employee.findUnique({ where: { employeeCode: input.employeeData.employeeCode } })) {
    return { ok: false, reason: 'EMPLOYEE_CODE_TAKEN' };
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: null,
      name: input.name,
      role: input.role,
      employee: {
        create: {
          employeeCode: input.employeeData.employeeCode,
          department: input.employeeData.department,
          title: input.employeeData.title,
          hireDate: input.employeeData.hireDate,
          managerId: input.employeeData.managerId,
        },
      },
    },
  });

  const token = await issueInviteToken(user.id);

  await recordAudit({
    actorUserId: input.invitedByUserId,
    action: 'STAFF_INVITED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: input.role, email },
  });

  await sendEmail({
    to: user.email,
    template: 'invite-staff',
    data: {
      name: user.name,
      roleLabel: roleLabel[input.role],
      acceptUrl: `${process.env.APP_URL ?? ''}/invite/${token}`,
    },
  });

  return { ok: true, userId: user.id, token };
}

export type AcceptInviteResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export async function acceptInvite(input: {
  token: string;
  password: string;
}): Promise<AcceptInviteResult> {
  const r = await consumeInviteToken(input.token);
  if (!r.ok) return r;
  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: r.userId }, data: { passwordHash } });
  await recordAudit({
    actorUserId: r.userId,
    action: 'INVITE_ACCEPTED',
    entityType: 'User',
    entityId: r.userId,
  });
  return { ok: true, userId: r.userId };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const lower = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: lower } });
  // Silent success when user doesn't exist — avoids account enumeration.
  if (!user || !user.isActive) return;

  const token = await issuePasswordResetToken(user.id);
  await sendEmail({
    to: user.email,
    template: 'password-reset',
    data: {
      name: user.name,
      resetUrl: `${process.env.APP_URL ?? ''}/reset/${token}`,
    },
  });
}

export type SetNewPasswordResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export async function setNewPasswordWithResetToken(input: {
  token: string;
  password: string;
}): Promise<SetNewPasswordResult> {
  const r = await consumePasswordResetToken(input.token);
  if (!r.ok) return r;
  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: r.userId }, data: { passwordHash } });
  await recordAudit({
    actorUserId: r.userId,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: r.userId,
  });
  return { ok: true, userId: r.userId };
}
