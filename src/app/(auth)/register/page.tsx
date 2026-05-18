import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Create account · ItsNotTechy Careers' };

export default function RegisterPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Create your candidate account</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Already have one?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
          <div className="mt-4">
            <RegisterForm />
          </div>
        </Card>
      </main>
    </>
  );
}
