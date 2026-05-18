import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold text-brand-600">403</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">No access</h1>
        <p className="mt-4 text-slate-600">
          Your account doesn&apos;t have permission to view this page.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
