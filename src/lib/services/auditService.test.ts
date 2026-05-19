import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { listAudit, listAuditActions } from './auditService';

async function seed() {
  const u = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
  await prisma.auditLog.createMany({
    data: [
      { actorUserId: u.id, action: 'JOB_CREATED',         entityType: 'Job',         entityId: 'j1' },
      { actorUserId: u.id, action: 'JOB_PUBLISHED',       entityType: 'Job',         entityId: 'j1' },
      { actorUserId: u.id, action: 'APP_STAGE_CHANGED',   entityType: 'Application', entityId: 'a1' },
    ],
  });
  return u;
}

describe('listAudit', () => {
  beforeEach(() => resetDb());

  it('returns paginated rows desc by createdAt', async () => {
    await seed();
    const r = await listAudit({ page: 1, pageSize: 10 });
    expect(r.total).toBe(3);
    expect(r.rows).toHaveLength(3);
  });

  it('filters by action', async () => {
    await seed();
    const r = await listAudit({ action: 'JOB_PUBLISHED' });
    expect(r.total).toBe(1);
    expect(r.rows[0]?.action).toBe('JOB_PUBLISHED');
  });

  it('filters by entityType', async () => {
    await seed();
    const r = await listAudit({ entityType: 'Application' });
    expect(r.total).toBe(1);
  });
});

describe('listAuditActions', () => {
  beforeEach(() => resetDb());

  it('returns distinct action strings sorted ascending', async () => {
    await seed();
    const actions = await listAuditActions();
    expect(actions).toEqual(['APP_STAGE_CHANGED', 'JOB_CREATED', 'JOB_PUBLISHED']);
  });
});
