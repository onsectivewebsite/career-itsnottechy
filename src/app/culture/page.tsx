import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: "Culture & Belonging · It's Not Techy Careers",
  description: "How the It's Not Techy team works, what we value, and our commitment to belonging.",
};

const VALUES: { title: string; body: string }[] = [
  { title: 'Senior people, real outcomes', body: 'Senior practitioners work directly on every account. We measure success by pipeline and revenue, not billable hours.' },
  { title: 'Transparency by default', body: 'Clear scopes, honest timelines, and shared dashboards. Clients and teammates always know where things stand.' },
  { title: 'One connected team', body: 'Web, brand, content, and paid specialists work as one system so campaigns compound rather than compete.' },
  { title: 'Curiosity over comfort', body: 'We test, learn, and adopt new tools — including AI workflows — faster than the industry average.' },
];

export default function CulturePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Working here</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Culture &amp; Belonging</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              It&apos;s Not Techy is a global digital marketing agency built on senior craft, candour, and
              genuine care for the people who do the work.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">What we value</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {VALUES.map((v) => (
                <div key={v.title} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-brand-700">{v.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Belonging is the baseline</h2>
            <p className="mt-4 text-lg text-slate-600">
              Our work spans eight offices across the Americas, EMEA, APAC, and Oceania — and our team
              reflects that reach. We hire for craft and character, build accommodations into how we work,
              and expect every person to be heard regardless of role, office, or background. Mentorship,
              clear progression, and pay equity are commitments, not perks.
            </p>
            <div className="mt-8">
              <Link href="/jobs"><Button size="lg">See open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
