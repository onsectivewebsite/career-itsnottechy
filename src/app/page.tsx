import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Build what&apos;s next at ItsNotTechy.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            We&apos;re a small team building practical software. Browse open roles or
            create an account to track your applications.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/jobs">
              <Button size="lg">See open roles</Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="secondary">Create candidate account</Button>
            </Link>
          </div>
        </section>
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
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">
            © {new Date().getFullYear()} ItsNotTechy.
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
