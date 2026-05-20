import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
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
              headquartered in Toronto, Canada. Founded in 2026, we help growth-stage
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
              <Stat value="2026" label="Founded" />
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

        {/* How hiring works */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">The process</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">How hiring works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <HiringStep n="1" title="Apply" body="Submit your application and any documents the role asks for." />
              <HiringStep n="2" title="Review" body="A hiring manager reads every application by hand." />
              <HiringStep n="3" title="Interview" body="One or two conversations with the team you'd join." />
              <HiringStep n="4" title="Offer" body="A clear written offer — usually within two to three weeks." />
            </div>
          </div>
        </section>

        {/* Leadership teaser */}
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">Led by the people doing the work</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Flat, senior, and organised into focused departments — management here exists to remove
              blockers and grow people.
            </p>
            <div className="mt-8">
              <Link href="/leadership">
                <Button size="lg" variant="secondary">How we&apos;re organised</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Explore the company */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Explore It&apos;s Not Techy
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Get to know us before you apply
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <ExploreCard href="/culture" title="Culture & Belonging" body="Our values, how we work, and our commitment to belonging." />
              <ExploreCard href="/benefits" title="Benefits & Perks" body="Pay, flexible working, time off, and how we invest in growth." />
              <ExploreCard href="/resources" title="Candidate Resources" body="How hiring works, interview tips, and common questions." />
              <ExploreCard href="/life" title="Life & Offices" body="Eight offices across four regions, and daily life on the team." />
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
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

function ExploreCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300"
    >
      <h3 className="font-semibold text-brand-700">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </Link>
  );
}

function HiringStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
