import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getToken before importing the middleware so its module-level imports use the mock.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import { middleware } from './middleware';

function req(pathname: string): NextRequest {
  return new NextRequest(new Request(`http://localhost:3000${pathname}`));
}

describe('middleware', () => {
  it('lets public paths through', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(req('/'));
    expect(res.status).toBe(200);
  });

  it('redirects unauthed user from /dashboard/* to /login with returnTo', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(307);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/login');
    expect(loc).toContain('returnTo=%2Fdashboard%2Fhr');
  });

  it('forbids EMPLOYEE accessing /dashboard/hr', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'EMPLOYEE' });
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/403');
  });

  it('allows HR_MANAGER on /dashboard/hr', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'HR_MANAGER' });
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN everywhere under /dashboard', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'SUPER_ADMIN' });
    for (const p of [
      '/dashboard/admin', '/dashboard/hr', '/dashboard/manager',
      '/dashboard/employee', '/dashboard/candidate',
    ]) {
      const res = await middleware(req(p));
      expect(res.status, p).toBe(200);
    }
  });

  it('redirects /dashboard root to the per-role dashboard', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'CANDIDATE' });
    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard/candidate');
  });
});
