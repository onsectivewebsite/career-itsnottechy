import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { recordAudit } from './audit';

describe('recordAudit', () => {
  beforeEach(() => resetDb());

  it('inserts an AuditLog row with the given fields', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@x.com', name: 'A', role: 'HR_MANAGER' },
    });
    await recordAudit({
      actorUserId: user.id,
      action: 'JOB_CREATED',
      entityType: 'Job',
      entityId: 'job-1',
      metadata: { title: 'Engineer' },
    });
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: user.id,
      action: 'JOB_CREATED',
      entityType: 'Job',
      entityId: 'job-1',
    });
    expect(rows[0]!.metadata).toEqual({ title: 'Engineer' });
  });

  it('allows a null actor (system-triggered events)', async () => {
    await recordAudit({
      actorUserId: null,
      action: 'SYSTEM_TASK_RAN',
      entityType: 'System',
      entityId: 'cron-1',
    });
    const rows = await prisma.auditLog.findMany();
    expect(rows[0]!.actorUserId).toBeNull();
  });
});
