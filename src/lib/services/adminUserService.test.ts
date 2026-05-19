import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { listUsers, setUserRole, setUserActive } from './adminUserService';

describe('listUsers', () => {
  beforeEach(() => resetDb());

  it('returns users with their employee details when present', async () => {
    const u = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'EMPLOYEE' } });
    await prisma.employee.create({ data: { userId: u.id, employeeCode: 'E1', department: 'X', title: 'T', hireDate: new Date() } });
    const list = await listUsers();
    expect(list).toHaveLength(1);
    expect(list[0]?.employee?.employeeCode).toBe('E1');
  });
});

describe('setUserRole', () => {
  beforeEach(() => resetDb());

  it('changes role + writes audit', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const u = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    await prisma.employee.create({ data: { userId: u.id, employeeCode: 'E1', department: 'X', title: 'T', hireDate: new Date() } });
    const r = await setUserRole({ userId: u.id, newRole: 'MANAGER', actorUserId: admin.id });
    expect(r.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('MANAGER');
    expect(await prisma.auditLog.count({ where: { action: 'USER_ROLE_CHANGED' } })).toBe(1);
  });

  it('refuses to demote the last active SUPER_ADMIN', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const r = await setUserRole({ userId: admin.id, newRole: 'EMPLOYEE', actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'LAST_ADMIN' });
  });

  it('allows demoting a SUPER_ADMIN when another exists', async () => {
    const a1 = await prisma.user.create({ data: { email: 'a1@x.com', name: 'A1', role: 'SUPER_ADMIN' } });
    const a2 = await prisma.user.create({ data: { email: 'a2@x.com', name: 'A2', role: 'SUPER_ADMIN' } });
    await prisma.employee.create({ data: { userId: a2.id, employeeCode: 'E2', department: 'X', title: 'T', hireDate: new Date() } });
    const r = await setUserRole({ userId: a2.id, newRole: 'EMPLOYEE', actorUserId: a1.id });
    expect(r.ok).toBe(true);
  });

  it('refuses to promote a CANDIDATE to staff role when no Employee row exists', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const c = await prisma.user.create({
      data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const r = await setUserRole({ userId: c.id, newRole: 'EMPLOYEE', actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'NO_EMPLOYEE_RECORD' });

    // Sanity: role unchanged
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).role).toBe('CANDIDATE');
  });

  it('allows promoting an EMPLOYEE up to HR_MANAGER (employee row exists)', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const e = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    await prisma.employee.create({
      data: { userId: e.id, employeeCode: 'E01', department: 'X', title: 'T', hireDate: new Date() },
    });
    const r = await setUserRole({ userId: e.id, newRole: 'HR_MANAGER', actorUserId: admin.id });
    expect(r.ok).toBe(true);
  });
});

describe('setUserActive', () => {
  beforeEach(() => resetDb());

  it('deactivates a user + audits', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const u = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE' } });
    const r = await setUserActive({ userId: u.id, active: false, actorUserId: admin.id });
    expect(r.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).isActive).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: 'USER_DEACTIVATED' } })).toBe(1);
  });

  it('refuses to deactivate self', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const r = await setUserActive({ userId: admin.id, active: false, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'SELF' });
  });

  it('refuses to deactivate the last active SUPER_ADMIN', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const other = await prisma.user.create({ data: { email: 'o@x.com', name: 'O', role: 'SUPER_ADMIN' } });
    // Setup: deactivate `other` so `admin` is the LAST active. Then a different actor (`other`) tries to deactivate `admin`.
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    const r = await setUserActive({ userId: admin.id, active: false, actorUserId: other.id });
    expect(r).toEqual({ ok: false, reason: 'LAST_ADMIN' });
  });

  it('reactivates a deactivated user', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const u = await prisma.user.create({ data: { email: 'e@x.com', name: 'E', role: 'EMPLOYEE', isActive: false } });
    const r = await setUserActive({ userId: u.id, active: true, actorUserId: admin.id });
    expect(r.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'USER_REACTIVATED' } })).toBe(1);
  });
});
