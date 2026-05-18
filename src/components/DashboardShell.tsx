import Link from 'next/link';
import type { Role } from '@prisma/client';
import { SignOutButton } from './SignOutButton';

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { href: '/dashboard/admin', label: 'Overview' },
    { href: '/dashboard/admin/users', label: 'Users' },
    { href: '/dashboard/admin/audit', label: 'Audit log' },
    { href: '/dashboard/hr', label: 'HR view' },
  ],
  HR_MANAGER: [
    { href: '/dashboard/hr', label: 'Overview' },
    { href: '/dashboard/hr/jobs', label: 'Job postings' },
    { href: '/dashboard/hr/applicants', label: 'Applicants' },
    { href: '/dashboard/hr/referrals', label: 'Referrals' },
    { href: '/dashboard/hr/promotions', label: 'Promotions' },
    { href: '/dashboard/hr/invite', label: 'Invite staff' },
  ],
  MANAGER: [
    { href: '/dashboard/manager', label: 'Overview' },
    { href: '/dashboard/manager/promotions', label: 'Promotion inbox' },
    { href: '/dashboard/employee', label: 'My referrals' },
  ],
  EMPLOYEE: [
    { href: '/dashboard/employee', label: 'Overview' },
    { href: '/dashboard/employee/refer', label: 'Refer a candidate' },
    { href: '/dashboard/employee/referrals', label: 'My referrals' },
    { href: '/dashboard/employee/promotions', label: 'Promotion requests' },
  ],
  CANDIDATE: [
    { href: '/dashboard/candidate', label: 'My applications' },
    { href: '/dashboard/candidate/profile', label: 'Profile' },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_MANAGER:  'HR Manager',
  MANAGER:     'Manager',
  EMPLOYEE:    'Employee',
  CANDIDATE:   'Candidate',
};

export function DashboardShell({
  children, userName, role,
}: { children: React.ReactNode; userName: string; role: Role }) {
  const nav = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-bold text-brand-700">ItsNotTechy Careers</Link>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[role]}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="w-56 shrink-0">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200/60"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
