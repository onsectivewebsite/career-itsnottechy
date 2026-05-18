import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { registerCandidate, inviteStaff } from './userService';
import { verifyPassword } from '@/lib/password';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

beforeEach(async () => {
  process.env.EMAIL_TEST_MODE = 'true';
  __resetTransportForTests();
  await resetDb();
});

describe('registerCandidate', () => {
  it('creates a User+CandidateProfile, hashes the password, sends welcome email', async () => {
    const result = await registerCandidate({
      email: 'alice@example.com',
      password: 'Hunter2pass',
      name: 'Alice',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { candidateProfile: true },
    });
    expect(user?.role).toBe('CANDIDATE');
    expect(user?.candidateProfile).not.toBeNull();
    expect(await verifyPassword('Hunter2pass', user!.passwordHash)).toBe(true);

    expect(__recordedSendsForTests()).toHaveLength(1);
    expect(__recordedSendsForTests()[0]?.to).toBe('alice@example.com');

    const audits = await prisma.auditLog.findMany();
    expect(audits.find((a) => a.action === 'USER_REGISTERED')).toBeDefined();
  });

  it('lowercases the email', async () => {
    const r = await registerCandidate({
      email: 'BOB@Example.com', password: 'Hunter2pass', name: 'Bob',
    });
    expect(r.ok).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: 'bob@example.com' } });
    expect(user).not.toBeNull();
  });

  it('returns EMAIL_TAKEN when email already exists', async () => {
    await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' });
    const r = await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A2' });
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });
});

describe('inviteStaff', () => {
  beforeEach(async () => { await resetDb(); __resetTransportForTests(); });

  it('creates a User (no password) + Employee + invite token; sends email', async () => {
    const inviter = await prisma.user.create({
      data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' },
    });
    const r = await inviteStaff({
      email: 'new@example.com',
      name: 'New Hire',
      role: 'EMPLOYEE',
      employeeData: {
        employeeCode: 'E001',
        department: 'Engineering',
        title: 'Software Engineer',
        hireDate: new Date('2026-06-01'),
        managerId: null,
      },
      invitedByUserId: inviter.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const user = await prisma.user.findUnique({
      where: { id: r.userId },
      include: { employee: true, inviteTokens: true },
    });
    expect(user?.role).toBe('EMPLOYEE');
    expect(user?.passwordHash).toBeNull();
    expect(user?.employee?.employeeCode).toBe('E001');
    expect(user?.inviteTokens).toHaveLength(1);
    expect(user?.inviteTokens[0]?.token).toBeTruthy();

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.to).toBe('new@example.com');
    expect(sends[0]?.html).toContain(user!.inviteTokens[0]!.token);

    const audits = await prisma.auditLog.findMany();
    expect(audits.find((a) => a.action === 'STAFF_INVITED')).toBeDefined();
  });

  it('rejects when email already exists', async () => {
    await prisma.user.create({ data: { email: 'dup@x.com', name: 'D', role: 'EMPLOYEE' } });
    const r = await inviteStaff({
      email: 'dup@x.com',
      name: 'X',
      role: 'EMPLOYEE',
      employeeData: { employeeCode: 'E002', department: 'X', title: 'X', hireDate: new Date(), managerId: null },
      invitedByUserId: 'system',
    });
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });

  it('rejects when employeeCode is taken', async () => {
    await prisma.user.create({
      data: {
        email: 'first@x.com', name: 'First', role: 'EMPLOYEE',
        employee: { create: { employeeCode: 'E099', department: 'X', title: 'X', hireDate: new Date() } },
      },
    });
    const r = await inviteStaff({
      email: 'second@x.com',
      name: 'Second',
      role: 'EMPLOYEE',
      employeeData: { employeeCode: 'E099', department: 'X', title: 'X', hireDate: new Date(), managerId: null },
      invitedByUserId: 'system',
    });
    expect(r).toEqual({ ok: false, reason: 'EMPLOYEE_CODE_TAKEN' });
  });
});
