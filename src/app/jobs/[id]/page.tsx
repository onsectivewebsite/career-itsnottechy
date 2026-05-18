import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { getPublicJob } from '@/lib/services/jobService';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { CustomQuestion } from '@/types/customQuestions';

const LOCATION_LABEL: Record<string, string> = { REMOTE: 'Remote', ONSITE: 'Onsite', HYBRID: 'Hybrid' };
const TYPE_LABEL:     Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERN: 'Intern' };

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getPublicJob(params.id);
  if (!job) notFound();
  const customQuestions = (job.customQuestions as unknown as CustomQuestion[]) ?? [];

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/jobs" className="text-sm text-brand-600 hover:underline">&larr; All roles</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{job.department}</span>
          <span>&middot;</span>
          <Badge tone="blue">{LOCATION_LABEL[job.locationType]}{job.locationCity ? ` · ${job.locationCity}` : ''}</Badge>
          <Badge tone="neutral">{TYPE_LABEL[job.type]}</Badge>
          {job.salaryMin && job.salaryMax && (
            <Badge tone="green">{job.currency} {job.salaryMin.toLocaleString()} – {job.salaryMax.toLocaleString()}</Badge>
          )}
        </div>

        <section className="prose mt-8 max-w-none">
          <h2 className="text-lg font-semibold">About the role</h2>
          <p className="whitespace-pre-wrap text-slate-700">{job.description}</p>

          <h2 className="mt-6 text-lg font-semibold">Requirements</h2>
          <p className="whitespace-pre-wrap text-slate-700">{job.requirements}</p>
        </section>

        <div className="mt-10">
          <Link href={`/jobs/${job.id}/apply`}>
            <Button size="lg">Apply for this role</Button>
          </Link>
          {customQuestions.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              This application includes {customQuestions.length} additional question{customQuestions.length === 1 ? '' : 's'}.
            </p>
          )}
          {job.deadline && (
            <p className="mt-2 text-xs text-slate-500">Apply by {job.deadline.toISOString().slice(0, 10)}.</p>
          )}
        </div>
      </main>
    </>
  );
}
