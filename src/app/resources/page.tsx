import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: "Candidate Resources · It's Not Techy Careers",
  description: "How hiring works at It's Not Techy, interview tips, and answers to common questions.",
};

const STEPS: { n: string; title: string; body: string }[] = [
  { n: '1', title: 'Apply', body: 'Submit your application and any documents the role asks for. You will get an email confirmation.' },
  { n: '2', title: 'Review', body: 'A hiring manager reviews every application by hand — no black-box screening.' },
  { n: '3', title: 'Interview', body: 'One or two conversations with the team you would work with, focused on real craft.' },
  { n: '4', title: 'Offer', body: 'A clear written offer. We aim to keep the whole process to two to three weeks.' },
];

const TIPS: string[] = [
  'Show outcomes, not just tasks — pipeline, revenue, and growth tell the story.',
  'Bring examples of work you are proud of and can speak to in depth.',
  'Have questions ready; interviews go both ways.',
  'Upload requested documents promptly so your application keeps moving.',
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need an account to apply?', a: 'Yes — create a free candidate account so you can track your application and upload documents.' },
  { q: 'Can I apply to more than one role?', a: 'Absolutely. Each application is reviewed on its own merits.' },
  { q: 'What documents will I need?', a: 'A resume always; some roles also request items such as a portfolio or work-eligibility proof. The apply form lists exactly what is required.' },
  { q: 'How will I hear back?', a: 'By email, and your candidate dashboard always shows your current stage.' },
];

export default function ResourcesPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">For candidates</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Candidate Resources</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Everything you need to apply with confidence — how hiring works, how to prepare, and answers
              to common questions.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">How hiring works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-lg border border-slate-200 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{s.n}</div>
                  <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Interview preparation</h2>
            <ul className="mt-4 space-y-2">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2 text-slate-600">
                  <span aria-hidden className="text-brand-600">&#10003;</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer font-medium text-slate-900">{item.q}</summary>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">Browse open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
