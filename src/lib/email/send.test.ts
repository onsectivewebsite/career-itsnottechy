import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { sendEmail } from './send';
import { __recordedSendsForTests, __resetTransportForTests } from './transport';

beforeEach(async () => {
  process.env.EMAIL_TEST_MODE = 'true';
  __resetTransportForTests();
  await resetDb();
});

afterEach(() => __resetTransportForTests());

describe('sendEmail', () => {
  it('writes an EmailLog row with status SENT in test mode', async () => {
    await sendEmail({
      to: 'a@x.com',
      template: 'welcome-candidate',
      data: { name: 'Alice', dashboardUrl: 'http://x' },
    });

    const recorded = __recordedSendsForTests();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.to).toBe('a@x.com');

    const logs = await prisma.emailLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      toEmail: 'a@x.com',
      subject: 'Welcome to ItsNotTechy Careers',
      template: 'welcome-candidate',
      status: 'SENT',
    });
    expect(logs[0]?.sentAt).not.toBeNull();
  });

  it('records FAILED + error and does not throw when transport fails', async () => {
    process.env.EMAIL_TEST_MODE = 'false';
    process.env.SMTP_HOST = 'invalid-host-that-does-not-exist.local';
    process.env.SMTP_PORT = '1';
    process.env.SMTP_USER = 'x';
    process.env.SMTP_PASS = 'x';
    __resetTransportForTests();

    await expect(
      sendEmail({
        to: 'a@x.com',
        template: 'welcome-candidate',
        data: { name: 'A', dashboardUrl: 'http://x' },
      }),
    ).resolves.toBeUndefined();

    const log = await prisma.emailLog.findFirst();
    expect(log?.status).toBe('FAILED');
    expect(log?.error).toBeTruthy();
  }, 30_000);
});
