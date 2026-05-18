import { afterEach, describe, expect, it } from 'vitest';
import {
  getTransport,
  __resetTransportForTests,
  __recordedSendsForTests,
} from './transport';

afterEach(() => __resetTransportForTests());

describe('getTransport in EMAIL_TEST_MODE', () => {
  it('returns a fake transport that records sends', async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    const t = getTransport();
    await t.sendMail({
      from: 'a@x.com',
      to: 'b@x.com',
      subject: 'hi',
      html: '<p>hi</p>',
    });
    const recorded = __recordedSendsForTests();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      to: 'b@x.com',
      subject: 'hi',
    });
  });
});
