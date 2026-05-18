import { describe, expect, it } from 'vitest';
import { referralInputSchema } from './referrals';

describe('referralInputSchema', () => {
  it('accepts a minimal valid referral', () => {
    const r = referralInputSchema.parse({
      jobId: 'job-1',
      candidateName: 'Jordan Reed',
      candidateEmail: 'Jordan@example.com',
      relationship: 'Former colleague',
    });
    expect(r.candidateEmail).toBe('jordan@example.com');
    expect(r.candidateName).toBe('Jordan Reed');
  });

  it('rejects invalid email', () => {
    expect(() => referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'not-an-email', relationship: 'x',
    })).toThrow();
  });

  it('rejects empty relationship', () => {
    expect(() => referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'a@x.com', relationship: '',
    })).toThrow();
  });

  it('accepts optional resume URL', () => {
    const r = referralInputSchema.parse({
      jobId: 'job-1', candidateName: 'A', candidateEmail: 'a@x.com', relationship: 'x',
      resumeUrl: 'supporting-doc/x.pdf',
    });
    expect(r.resumeUrl).toBe('supporting-doc/x.pdf');
  });
});
