import Link from 'next/link';

export function PublicNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-cropped.png"
            alt="It's Not Techy"
            className="h-10 w-auto"
          />
          <span className="hidden text-sm font-semibold text-slate-500 sm:inline">
            Careers
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
          <Link href="/jobs" className="text-slate-700 hover:text-slate-900">Open roles</Link>
          <Link href="/culture" className="text-slate-700 hover:text-slate-900">Culture</Link>
          <Link href="/benefits" className="text-slate-700 hover:text-slate-900">Benefits</Link>
          <Link href="/resources" className="text-slate-700 hover:text-slate-900">Resources</Link>
          <Link href="/life" className="text-slate-700 hover:text-slate-900">Life</Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
