import Link from 'next/link';

const LINKS: { href: string; label: string }[] = [
  { href: '/jobs', label: 'Open roles' },
  { href: '/culture', label: 'Culture & Belonging' },
  { href: '/benefits', label: 'Benefits & Perks' },
  { href: '/resources', label: 'Candidate Resources' },
  { href: '/life', label: 'Life & Offices' },
  { href: '/login', label: 'Sign in' },
];

export function PublicFooter() {
  return (
    <footer className="bg-ink-600">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light-cropped.png" alt="It's Not Techy" className="h-9 w-auto" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-slate-300 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-sm text-slate-400">
          © {new Date().getFullYear()} It&apos;s Not Techy. Digital marketing that speaks human.
        </p>
      </div>
    </footer>
  );
}
