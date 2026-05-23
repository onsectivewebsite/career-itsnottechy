import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { sendCustomEmail } from './sendCustom';

describe('sendCustomEmail', () => {
  beforeEach(() => resetDb());

  it('writes an EmailLog row with template=hr-custom and the sanitised body', async () => {
    await sendCustomEmail({
      to: 'c@x.com',
      subject: 'Hello',
      html: '<p>Hi <strong>Alice</strong></p><script>alert(1)</script>',
    });
    const log = await prisma.emailLog.findFirst({ where: { template: 'hr-custom' } });
    expect(log).not.toBeNull();
    expect(log?.toEmail).toBe('c@x.com');
    expect(log?.subject).toBe('Hello');
    expect(log?.status).toBe('SENT');
  });

  it('stores the source template id in the payload when provided', async () => {
    await sendCustomEmail({
      to: 'c@x.com', subject: 'X', html: '<p>x</p>', sourceTemplateId: 'tmpl-1',
    });
    const log = await prisma.emailLog.findFirst({ where: { template: 'hr-custom' } });
    expect((log?.payload as { sourceTemplateId?: string } | null)?.sourceTemplateId).toBe('tmpl-1');
  });
});
