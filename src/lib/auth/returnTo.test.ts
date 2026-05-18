import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
  it('returns null for null/undefined/empty', () => {
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo('')).toBeNull();
  });

  it('returns same-origin paths unchanged', () => {
    expect(sanitizeReturnTo('/dashboard/hr')).toBe('/dashboard/hr');
    expect(sanitizeReturnTo('/jobs/123?ref=email')).toBe('/jobs/123?ref=email');
  });

  it('rejects absolute external URLs', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBeNull();
    expect(sanitizeReturnTo('http://localhost:3000/dashboard')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnTo('//evil.com')).toBeNull();
    expect(sanitizeReturnTo('//evil.com/dashboard/hr')).toBeNull();
  });

  it('rejects backslash escape attempts', () => {
    expect(sanitizeReturnTo('/\\evil.com')).toBeNull();
  });

  it('rejects paths that do not start with slash', () => {
    expect(sanitizeReturnTo('dashboard')).toBeNull();
    expect(sanitizeReturnTo('javascript:alert(1)')).toBeNull();
  });
});
