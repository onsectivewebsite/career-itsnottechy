import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

const SERVICES = [
  'Web Design & Development',
  'SEO',
  'Social Media Marketing',
  'Video Production',
  'Brand Design',
  'Performance Marketing',
  'Marketing Platforms',
  'AI Marketing',
];

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <main>
        {/* Hero — brand-dark band */}
        <section className="relative overflow-hidden bg-ink-600">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at top, rgba(0,179,164,0.25), transparent 60%)',
            }}
          />
          <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-light-cropped.png"
              alt="It's Not Techy"
              className="mx-auto mb-10 h-16 w-auto"
            />
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">
              Careers at It&apos;s Not Techy
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Build what&apos;s next with{' '}
              <span className="gradient-text">marketing that speaks human.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              We&apos;re a global digital marketing agency hiring senior practitioners
              across web, brand, content, and performance. Browse open roles or create
              an account to track your applications.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/jobs">
                <Button size="lg">See open roles</Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="secondary">
                  Create candidate account
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Why apply */}
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-4xl gap-8 px-6 py-16 sm:grid-cols-3">
            <Feature title="Real people, real reviews">
              Every application goes to a hiring manager. No black-box screening.
            </Feature>
            <Feature title="Transparent process">
              Track exactly where your application sits in the pipeline at any time.
            </Feature>
            <Feature title="Referrals welcome">
              Know someone who&apos;d be a great fit? Existing team members can refer you in.
            </Feature>
          </div>
        </section>

        {/* About It's Not Techy */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              About the company
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              It&apos;s Not Techy
            </h2>
            <p className="mt-5 text-lg text-slate-600">
              It&apos;s Not Techy is a global, full-service digital marketing agency
              headquartered in Toronto, Canada. Founded in 2024, we help growth-stage
              brands turn marketing into a connected system — where web, brand, content,
              and paid campaigns compound rather than compete.
            </p>
            <p className="mt-4 text-lg text-slate-600">
              We staff senior practitioners directly on every account and measure
              success by pipeline and revenue, not vanity metrics. With eight offices
              across the Americas, EMEA, APAC, and Oceania, we operate as the official
              marketing partner of{' '}
              <a
                href="https://onsective.com"
                className="font-medium text-brand-700 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Onsective Inc.
              </a>
              , a global IT consultancy.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Stat value="2024" label="Founded" />
              <Stat value="8" label="Global offices" />
              <Stat value="Toronto" label="Headquarters" />
            </div>

            <h3 className="mt-12 text-sm font-semibold uppercase tracking-widest text-slate-500">
              What we do
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Footer — brand-dark */}
        <footer className="bg-ink-600">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-light-cropped.png"
              alt="It's Not Techy"
              className="h-9 w-auto"
            />
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} It&apos;s Not Techy. Digital marketing that
              speaks human.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{children}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="text-2xl font-bold text-brand-600">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}
