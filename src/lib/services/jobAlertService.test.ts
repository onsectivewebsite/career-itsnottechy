import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { setJobAlerts, notifyNewJob } from './jobAlertService';

async function makeCandidate(email: string, alertsOn: boolean) {
  return prisma.user.create({
    data: {
      email, name: 'Cand', role: 'CANDIDATE',
      candidateProfile: { create: { jobAlertsEnabled: alertsOn } },
    },
  });
}

describe('setJobAlerts', () => {
  beforeEach(() => resetDb());

  it('turns the flag on and off', async () => {
    const cand = await makeCandidate('c@x.com', false);
    await setJobAlerts({ candidateUserId: cand.id, enabled: true });
    let profile = await prisma.candidateProfile.findUnique({ where: { userId: cand.id } });
    expect(profile?.jobAlertsEnabled).toBe(true);
    await setJobAlerts({ candidateUserId: cand.id, enabled: false });
    profile = await prisma.candidateProfile.findUnique({ where: { userId: cand.id } });
    expect(profile?.jobAlertsEnabled).toBe(false);
  });
});

describe('notifyNewJob', () => {
  beforeEach(() => resetDb());

  it('notifies only candidates with alerts enabled', async () => {
    await makeCandidate('on@x.com', true);
    await makeCandidate('off@x.com', false);
    const count = await notifyNewJob({ id: 'job1', title: 'Senior Designer' });
    expect(count).toBe(1);
  });

  it('returns 0 when nobody is subscribed', async () => {
    await makeCandidate('off@x.com', false);
    expect(await notifyNewJob({ id: 'job1', title: 'Role' })).toBe(0);
  });
});
