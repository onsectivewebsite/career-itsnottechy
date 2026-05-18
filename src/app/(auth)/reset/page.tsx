import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { RequestForm } from './RequestForm';

export const metadata = { title: 'Reset password · ItsNotTechy Careers' };

export default function ResetRequestPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Reset your password</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Enter the email on your account and we&apos;ll send a reset link.
          </p>
          <div className="mt-4">
            <RequestForm />
          </div>
          <p className="mt-4 text-sm text-slate-600">
            <Link href="/login" className="hover:underline">Back to sign in</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
