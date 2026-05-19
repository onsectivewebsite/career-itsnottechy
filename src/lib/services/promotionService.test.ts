import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  submitPromotion,
  managerDecision,
  hrDecision,
  listMine,
  listForManager,
  listForHr,
} from './promotionService';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

async function setupChain() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const managerUser = await prisma.user.create({
    data: { email: 'mgr@x.com', name: 'Mgr', role: 'MANAGER' },
  });
  const managerEmp = await prisma.employee.create({
    data: { userId: managerUser.id, employeeCode: 'M001', department: 'Eng', title: 'Eng Manager', hireDate: new Date(), managerId: null },
  });
  const empUser = await prisma.user.create({
    data: { email: 'emp@x.com', name: 'Emp', role: 'EMPLOYEE' },
  });
  await prisma.employee.create({
    data: { userId: empUser.id, employeeCode: 'E001', department: 'Eng', title: 'Engineer II', hireDate: new Date(), managerId: managerEmp.id },
  });
  return { hr, managerUser, managerEmp, empUser };
}

const baseInput = {
  currentTitle: 'Engineer II',
  targetTitle: 'Senior Engineer',
  justification: 'Led the migration project for six months and shipped on time.',
};

describe('submitPromotion', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('creates a PENDING_MANAGER request and emails submitter + manager', async () => {
    const { managerUser, empUser } = await setupChain();
    __resetTransportForTests();
    const r = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: r.promotionId } });
    expect(row.finalStatus).toBe('PENDING_MANAGER');
    expect(row.managerUserId).toBe(managerUser.id);

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(2);
    const toEmails = sends.map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, managerUser.email].sort());

    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'PROMOTION_SUBMITTED')).toBe(true);
  });

  it('returns NO_MANAGER when the employee has no manager set', async () => {
    const empUser = await prisma.user.create({ data: { email: 'lone@x.com', name: 'Lone', role: 'EMPLOYEE' } });
    await prisma.employee.create({
      data: { userId: empUser.id, employeeCode: 'L001', department: 'X', title: 'Solo', hireDate: new Date(), managerId: null },
    });
    const r = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    expect(r).toEqual({ ok: false, reason: 'NO_MANAGER' });
  });

  it('returns NO_EMPLOYEE_ROW when the user has no Employee record', async () => {
    const candUser = await prisma.user.create({
      data: { email: 'cand@x.com', name: 'Cand', role: 'CANDIDATE', candidateProfile: { create: {} } },
    });
    const r = await submitPromotion({ employeeUserId: candUser.id, input: baseInput });
    expect(r).toEqual({ ok: false, reason: 'NO_EMPLOYEE_ROW' });
  });
});

describe('managerDecision', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('APPROVE moves PENDING_MANAGER → PENDING_HR, emails submitter + HR group', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();

    __resetTransportForTests();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: managerUser.id,
      decision: 'APPROVED', notes: 'Great fit.',
    });
    expect(r.ok).toBe(true);

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('PENDING_HR');
    expect(row.managerDecision).toBe('APPROVED');
    expect(row.managerNotes).toBe('Great fit.');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, hr.email].sort());
  });

  it('REJECT moves PENDING_MANAGER → REJECTED, emails submitter + HR group', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();

    __resetTransportForTests();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: managerUser.id,
      decision: 'REJECTED', notes: 'Not yet.',
    });
    expect(r.ok).toBe(true);

    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('REJECTED');
    expect(row.managerDecision).toBe('REJECTED');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, hr.email].sort());
  });

  it('refuses NOT_MANAGER when actor is not the assigned manager', async () => {
    const { empUser } = await setupChain();
    const stranger = await prisma.user.create({ data: { email: 'x@x.com', name: 'X', role: 'MANAGER' } });
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    const r = await managerDecision({
      promotionId: sub.promotionId, actorUserId: stranger.id, decision: 'APPROVED',
    });
    expect(r).toEqual({ ok: false, reason: 'NOT_MANAGER' });
  });

  it('refuses WRONG_STATUS if request is no longer PENDING_MANAGER', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    const r2 = await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'REJECTED' });
    expect(r2).toEqual({ ok: false, reason: 'WRONG_STATUS' });
  });

  it('two concurrent decisions: exactly one wins', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    __resetTransportForTests();
    const [a, b] = await Promise.all([
      managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' }),
      managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'REJECTED' }),
    ]);
    const wins = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: 'WRONG_STATUS' });
    expect(__recordedSendsForTests()).toHaveLength(2);
  });
});

describe('hrDecision', () => {
  beforeEach(async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    __resetTransportForTests();
    await resetDb();
  });

  it('APPROVE moves PENDING_HR → APPROVED, emails submitter + manager', async () => {
    const { hr, managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });

    __resetTransportForTests();
    const r = await hrDecision({ promotionId: sub.promotionId, actorUserId: hr.id, decision: 'APPROVED' });
    expect(r.ok).toBe(true);
    const row = await prisma.promotionRequest.findUniqueOrThrow({ where: { id: sub.promotionId } });
    expect(row.finalStatus).toBe('APPROVED');
    expect(row.hrDecision).toBe('APPROVED');

    const toEmails = __recordedSendsForTests().map((s) => s.to).sort();
    expect(toEmails).toEqual([empUser.email, managerUser.email].sort());
  });

  it('refuses WRONG_STATUS if request is not PENDING_HR', async () => {
    const { hr, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    const r = await hrDecision({ promotionId: sub.promotionId, actorUserId: hr.id, decision: 'APPROVED' });
    expect(r).toEqual({ ok: false, reason: 'WRONG_STATUS' });
  });
});

describe('list helpers', () => {
  beforeEach(() => resetDb());

  it('listMine returns the submitter\'s requests', async () => {
    const { empUser } = await setupChain();
    await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    const list = await listMine(empUser.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.currentTitle).toBe('Engineer II');
  });

  it('listForManager returns only PENDING_MANAGER for that manager', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    let inbox = await listForManager(managerUser.id);
    expect(inbox).toHaveLength(1);

    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    inbox = await listForManager(managerUser.id);
    expect(inbox).toHaveLength(0);
  });

  it('listForHr returns only PENDING_HR', async () => {
    const { managerUser, empUser } = await setupChain();
    const sub = await submitPromotion({ employeeUserId: empUser.id, input: baseInput });
    if (!sub.ok) throw new Error();
    expect(await listForHr()).toHaveLength(0);

    await managerDecision({ promotionId: sub.promotionId, actorUserId: managerUser.id, decision: 'APPROVED' });
    expect(await listForHr()).toHaveLength(1);
  });
});
