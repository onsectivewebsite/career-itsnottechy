import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: "Life & Offices · It's Not Techy Careers",
  description: "Where It's Not Techy works — eight offices across four regions — and what daily life looks like.",
};

const OFFICES: { city: string; role: string }[] = [
  { city: 'Toronto, Canada', role: 'Global HQ' },
  { city: 'New York, USA', role: 'Americas Hub' },
  { city: 'London, United Kingdom', role: 'EMEA Hub' },
  { city: 'Dubai, UAE', role: 'Middle East Hub' },
  { city: 'Mumbai, India', role: 'APAC Delivery Center' },
  { city: 'Singapore', role: 'APAC Hub' },
  { city: 'Sydney, Australia', role: 'Oceania Hub' },
  { city: 'Berlin, Germany', role: 'EU Engineering' },
];

export default function LifePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Around the world</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Life &amp; Offices</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Eight offices, four regions, one connected team — staffed by local practitioners who know
              their markets.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Our offices</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {OFFICES.map((o) => (
                <div key={o.city} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{o.city}</h3>
                  <p className="mt-1 text-sm text-brand-700">{o.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">A day in the life</h2>
            <p className="mt-4 text-lg text-slate-600">
              No two days look the same, but the rhythm is consistent: focused mornings on craft, midday
              collaboration across time zones, and afternoons spent shipping work that moves a client&apos;s
              numbers. Teams are small and senior, meetings have a purpose, and async updates keep everyone
              aligned without living in their inbox. Whether you join from home or from one of our offices,
              you work alongside people who care about the outcome.
            </p>
            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">Find your role</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
