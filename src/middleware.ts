import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { Role } from '@prisma/client';

const PREFIX_ALLOWED: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/dashboard/admin',     roles: ['SUPER_ADMIN'] },
  { prefix: '/dashboard/hr',        roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
  { prefix: '/dashboard/manager',   roles: ['SUPER_ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/employee',  roles: ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
  { prefix: '/dashboard/candidate', roles: ['SUPER_ADMIN', 'CANDIDATE'] },
];

function dashboardFor(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/dashboard/admin';
    case 'HR_MANAGER':  return '/dashboard/hr';
    case 'MANAGER':     return '/dashboard/manager';
    case 'EMPLOYEE':    return '/dashboard/employee';
    case 'CANDIDATE':   return '/dashboard/candidate';
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Only intercept /dashboard*. Everything else passes through.
  if (!pathname.startsWith('/dashboard')) return NextResponse.next();

  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as
    | { id: string; role: Role }
    | null;

  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(dashboardFor(token.role), req.url));
  }

  const match = PREFIX_ALLOWED.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'));
  if (match && !match.roles.includes(token.role)) {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
