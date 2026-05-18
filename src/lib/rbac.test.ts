import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  AuthorizationError,
  hasRole,
  requireRole,
  requireAnyRole,
  dashboardPathForRole,
  type SessionUser,
} from './rbac';

const make = (role: Role): SessionUser => ({
  id: 'u1',
  email: 'u@x.com',
  name: 'U',
  role,
});

describe('hasRole', () => {
  it('true when user has one of the allowed roles', () => {
    expect(hasRole(make('HR_MANAGER'), ['HR_MANAGER', 'SUPER_ADMIN'])).toBe(true);
  });
  it('false when not', () => {
    expect(hasRole(make('EMPLOYEE'), ['HR_MANAGER'])).toBe(false);
  });
  it('false when user is null', () => {
    expect(hasRole(null, ['HR_MANAGER'])).toBe(false);
  });
});

describe('requireRole', () => {
  it('returns the user when role matches', () => {
    const u = make('SUPER_ADMIN');
    expect(requireRole(u, 'SUPER_ADMIN')).toBe(u);
  });
  it('throws AuthorizationError when role does not match', () => {
    expect(() => requireRole(make('EMPLOYEE'), 'HR_MANAGER')).toThrow(AuthorizationError);
  });
  it('throws when user is null', () => {
    expect(() => requireRole(null, 'EMPLOYEE')).toThrow(AuthorizationError);
  });
});

describe('requireAnyRole', () => {
  it('returns user when any role matches', () => {
    const u = make('MANAGER');
    expect(requireAnyRole(u, ['MANAGER', 'EMPLOYEE'])).toBe(u);
  });
  it('throws when none match', () => {
    expect(() => requireAnyRole(make('CANDIDATE'), ['MANAGER', 'EMPLOYEE'])).toThrow(AuthorizationError);
  });
});

describe('dashboardPathForRole', () => {
  it.each([
    ['SUPER_ADMIN', '/dashboard/admin'],
    ['HR_MANAGER', '/dashboard/hr'],
    ['MANAGER', '/dashboard/manager'],
    ['EMPLOYEE', '/dashboard/employee'],
    ['CANDIDATE', '/dashboard/candidate'],
  ] as const)('routes %s to %s', (role, path) => {
    expect(dashboardPathForRole(role)).toBe(path);
  });
});
