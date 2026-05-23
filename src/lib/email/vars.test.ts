import { describe, expect, it } from 'vitest';
import { buildEmailVars } from './vars';

describe('buildEmailVars', () => {
  it('resolves all fields from an application', () => {
    process.env.APP_URL = 'https://example.test';
    const vars = buildEmailVars({
      kind: 'application',
      candidate: { name: 'Alice' },
      job: { title: 'Designer' },
      stageLabel: 'Interview',
    });
    expect(vars).toEqual({
      candidateName: 'Alice',
      jobTitle: 'Designer',
      stageLabel: 'Interview',
      dashboardUrl: 'https://example.test/dashboard/candidate',
    });
  });

  it('returns empty strings for unavailable tokens in standalone mode', () => {
    process.env.APP_URL = 'https://example.test';
    expect(buildEmailVars({ kind: 'standalone', candidate: { name: 'Bob' } })).toEqual({
      candidateName: 'Bob',
      jobTitle: '',
      stageLabel: '',
      dashboardUrl: 'https://example.test/dashboard/candidate',
    });
  });

  it('uses the picked job title in standalone mode when provided', () => {
    expect(
      buildEmailVars({ kind: 'standalone', candidate: { name: 'Bob' }, job: { title: 'Engineer' } })
        .jobTitle,
    ).toBe('Engineer');
  });
});
