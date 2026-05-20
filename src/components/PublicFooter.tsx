import Link from 'next/link';

const EXPLORE: { href: string; label: string }[] = [
  { href: '/culture', label: 'Culture & Belonging' },
  { href: '/benefits', label: 'Benefits & Perks' },
  { href: '/resources', label: 'Candidate Resources' },
  { href: '/life', label: 'Life & Offices' },
  { href: '/leadership', label: 'Leadership & Departments' },
];

const CANDIDATE: { href: string; label: string }[] = [
  { href: '/jobs', label: 'Open roles' },
  { href: '/login', label: 'Sign in' },
  { href: '/register', label: 'Create account' },
];

export function PublicFooter() {
  return (
    <footer className="bg-ink-600">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-light-cropped.png" alt="It's Not Techy" className="h-9 w-auto" />
            <p className="mt-4 text-sm text-slate-400">Digital marketing that speaks human.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <ul className="mt-3 space-y-2">
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">For candidates</h3>
            <ul className="mt-3 space-y-2">
              {CANDIDATE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
            <address className="mt-3 space-y-2 text-sm not-italic text-slate-300">
              <p>1111 Albion Rd, Etobicoke,<br />ON M9V 2X3, Canada</p>
              <p><a href="tel:+16726737900" className="hover:text-white">+1 672-673-7900</a></p>
              <p><a href="mailto:info@itsnottechy.com" className="hover:text-white">info@itsnottechy.com</a></p>
            </address>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
          © {new Date().getFullYear()} It&apos;s Not Techy. Digital marketing that speaks human.
        </p>
      </div>
    </footer>
  );
}
