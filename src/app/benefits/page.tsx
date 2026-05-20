import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: "Benefits & Perks · It's Not Techy Careers",
  description: "Compensation, flexible working, time off, and growth at It's Not Techy.",
};

const PILLARS: { title: string; body: string }[] = [
  { title: 'Fair, transparent pay', body: 'Benchmarked salary bands reviewed annually, with pay equity across offices for comparable roles.' },
  { title: 'Remote & hybrid by design', body: 'Work from home or from any of our eight offices. Roles are clear about what, if anything, must be onsite.' },
  { title: 'Time off & wellbeing', body: 'Generous paid leave, local public holidays, parental leave, and wellbeing days you are encouraged to take.' },
  { title: 'Learning & growth', body: 'An annual learning budget, conference support, and a clear progression path with senior mentors.' },
];

const PERKS: string[] = [
  'Home-office setup stipend',
  'Annual learning & certification budget',
  'Team offsites and regional meetups',
  'Health coverage appropriate to your region',
  'Latest hardware of your choosing',
  'Paid volunteering days',
];

export default function BenefitsPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Rewards</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Benefits &amp; Perks</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              We invest in the people who do the work — with fair pay, real flexibility, and room to grow.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="grid gap-6 sm:grid-cols-2">
              {PILLARS.map((p) => (
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
            <h2 className="text-2xl font-bold text-slate-900">The extras</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {PERKS.map((perk) => (
                <span key={perk} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                  {perk}
                </span>
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
