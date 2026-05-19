import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { getSettings, updateSettings, __resetSettingsCacheForTests } from './systemSettings';

describe('systemSettings', () => {
  beforeEach(async () => {
    await resetDb();
    __resetSettingsCacheForTests();
  });

  it('returns defaults when no row exists', async () => {
    const s = await getSettings();
    expect(s.companyName).toBe('ItsNotTechy');
    expect(s.defaultSenderName).toBe('ItsNotTechy Careers');
  });

  it('upsert updates and invalidates cache', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', name: 'A', role: 'SUPER_ADMIN' } });
    const before = await getSettings();
    expect(before.companyName).toBe('ItsNotTechy');

    await updateSettings({ input: { companyName: 'Acme Corp' }, actorUserId: admin.id });
    const after = await getSettings();
    expect(after.companyName).toBe('Acme Corp');
    expect(await prisma.auditLog.count({ where: { action: 'SETTINGS_UPDATED' } })).toBe(1);
  });
});
