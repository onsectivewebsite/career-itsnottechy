import { describe, expect, it } from 'vitest';
import { interviewInputSchema } from './interviews';

describe('interviewInputSchema', () => {
  it('accepts a minimal valid interview', () => {
    const r = interviewInputSchema.parse({
      applicationId: 'app-1',
      scheduledAt: '2026-06-01T14:00:00.000Z',
      durationMinutes: 45,
      format: 'VIDEO',
      interviewerUserId: 'user-1',
      locationOrLink: 'https://meet.example.com/abc',
    });
    expect(r.scheduledAt).toBeInstanceOf(Date);
    expect(r.notes).toBeUndefined();
  });

  it('rejects past scheduledAt', () => {
    expect(() => interviewInputSchema.parse({
      applicationId: 'app-1',
      scheduledAt: '2020-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'VIDEO', interviewerUserId: 'u',
      locationOrLink: 'https://x',
    })).toThrow();
  });

  it('rejects duration < 15 or > 240', () => {
    const base = {
      applicationId: 'app-1', scheduledAt: '2099-01-01T00:00:00.000Z',
      format: 'VIDEO' as const, interviewerUserId: 'u', locationOrLink: 'x',
    };
    expect(() => interviewInputSchema.parse({ ...base, durationMinutes: 10 })).toThrow();
    expect(() => interviewInputSchema.parse({ ...base, durationMinutes: 300 })).toThrow();
  });

  it('rejects empty locationOrLink', () => {
    expect(() => interviewInputSchema.parse({
      applicationId: 'a', scheduledAt: '2099-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'VIDEO', interviewerUserId: 'u', locationOrLink: '',
    })).toThrow();
  });

  it('passes notes through (trimmed) when provided', () => {
    const r = interviewInputSchema.parse({
      applicationId: 'a', scheduledAt: '2099-01-01T00:00:00.000Z',
      durationMinutes: 45, format: 'PHONE', interviewerUserId: 'u',
      locationOrLink: '+1-555-0100', notes: '  please be ready  ',
    });
    expect(r.notes).toBe('please be ready');
  });

  it('coerces ISO UTC string with Z suffix to a Date at the expected UTC instant', () => {
    const r = interviewInputSchema.parse({
      applicationId: 'a',
      scheduledAt: '2099-06-01T14:00:00.000Z',
      durationMinutes: 45, format: 'VIDEO', interviewerUserId: 'u',
      locationOrLink: 'https://x',
    });
    expect(r.scheduledAt.toISOString()).toBe('2099-06-01T14:00:00.000Z');
  });
});
