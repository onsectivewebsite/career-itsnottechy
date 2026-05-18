import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { getPublicJob } from '@/lib/services/jobService';
import { getSessionUser } from '@/lib/auth/session';
import type { CustomQuestion } from '@/types/customQuestions';
import { ApplyForm } from './ApplyForm';

export const metadata = { title: 'Apply · ItsNotTechy Careers' };

export default async function ApplyPage({ params }: { params: { id: string } }) {
  const job = await getPublicJob(params.id);
  if (!job) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(`/jobs/${params.id}/apply`)}`);
  }
  if (user.role !== 'CANDIDATE') {
    // Staff and admins cannot apply to roles.
    return (
      <>
        <PublicNav />
        <main className="mx-auto max-w-2xl px-6 py-16">
          <Card>
            <CardTitle>Staff accounts can&apos;t apply</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Apply with a candidate account, or ask HR to invite the candidate.
            </p>
            <p className="mt-4">
              <Link href={`/jobs/${params.id}`} className="text-brand-600 hover:underline">
                Back to the role
              </Link>
            </p>
          </Card>
        </main>
      </>
    );
  }

  const questions = (job.customQuestions as unknown as CustomQuestion[]) ?? [];

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href={`/jobs/${params.id}`} className="text-sm text-brand-600 hover:underline">&larr; Back to the role</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Apply: {job.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{job.department}</p>

        <Card className="mt-8">
          <CardTitle>Your application</CardTitle>
          <div className="mt-4">
            <ApplyForm jobId={job.id} questions={questions} />
          </div>
        </Card>
      </main>
    </>
  );
}
