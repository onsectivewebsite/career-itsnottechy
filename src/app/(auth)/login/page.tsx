import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in · ItsNotTechy Careers' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Sign in</CardTitle>
          <LoginForm returnTo={searchParams.returnTo} />
          <p className="mt-4 text-sm text-slate-600">
            New here?{' '}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/reset" className="text-slate-500 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
