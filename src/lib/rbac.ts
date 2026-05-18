import { Role } from '@prisma/client';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function hasRole(user: SessionUser | null | undefined, allowed: Role[]): boolean {
  if (!user) return false;
  return allowed.includes(user.role);
}

export function requireRole(user: SessionUser | null | undefined, role: Role): SessionUser {
  if (!user || user.role !== role) throw new AuthorizationError();
  return user;
}

export function requireAnyRole(
  user: SessionUser | null | undefined,
  roles: Role[],
): SessionUser {
  if (!user || !roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/dashboard/admin';
    case 'HR_MANAGER':  return '/dashboard/hr';
    case 'MANAGER':     return '/dashboard/manager';
    case 'EMPLOYEE':    return '/dashboard/employee';
    case 'CANDIDATE':   return '/dashboard/candidate';
  }
}
