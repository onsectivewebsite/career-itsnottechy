'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold text-red-600">500</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-4 text-slate-600">
          An unexpected error occurred. We&apos;ve logged it for follow-up.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
