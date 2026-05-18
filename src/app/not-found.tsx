import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-4 text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
