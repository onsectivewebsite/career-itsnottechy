import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Leadership & Departments · It’s Not Techy Careers',
  description: 'How It’s Not Techy is led, and the departments that deliver the work.',
};

const PRINCIPLES: { title: string; body: string }[] = [
  { title: 'Practitioners own outcomes', body: 'Senior people lead the work directly and are accountable for the result — not for hours billed.' },
  { title: 'Flat and transparent', body: 'Decisions are made close to the work, in the open. Scopes, timelines, and trade-offs are shared.' },
  { title: 'Measured by impact', body: 'Teams are judged on pipeline and revenue moved for clients, not on vanity metrics.' },
  { title: 'Managers coach, not gate', body: 'Management exists to remove blockers and grow people — not to sit between the team and the work.' },
];

const DEPARTMENTS: string[] = [
  'Web Design & Development',
  'SEO',
  'Social Media',
  'Video Production',
  'Brand Design',
  'Performance Marketing',
  'Marketing Platforms',
  'AI Marketing',
];

export default function LeadershipPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">How we run</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Leadership &amp; Departments</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              It&apos;s Not Techy is led by the people doing the work — a flat, senior team organised
              into focused departments.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">How we lead</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-brand-700">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Our departments</h2>
            <p className="mt-2 text-slate-600">Each department is staffed by senior practitioners and works as one connected team.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DEPARTMENTS.map((d) => (
                <div key={d} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">See open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
