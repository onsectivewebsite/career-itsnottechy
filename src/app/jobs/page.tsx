import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { listPublicJobs } from '@/lib/services/jobService';
import { JobFilters } from '@/components/jobs/JobFilters';
import { Badge } from '@/components/ui/Badge';

export const metadata = { title: 'Open roles · ItsNotTechy Careers' };

const LOCATION_LABEL: Record<string, string> = { REMOTE: 'Remote', ONSITE: 'Onsite', HYBRID: 'Hybrid' };
const TYPE_LABEL:     Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERN: 'Intern' };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; department?: string; locationType?: 'REMOTE' | 'ONSITE' | 'HYBRID'; type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' };
}) {
  const jobs = await listPublicJobs(searchParams);

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Open roles</h1>
        <p className="mt-2 text-slate-600">{jobs.length} role{jobs.length === 1 ? '' : 's'} open right now.</p>

        <div className="mt-6">
          <JobFilters />
        </div>

        <ul className="mt-8 space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-300">
              <Link href={`/jobs/${job.id}`} className="block">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">{job.title}</h2>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{TYPE_LABEL[job.type]}</Badge>
                    <Badge tone="blue">{LOCATION_LABEL[job.locationType]}{job.locationCity ? ` · ${job.locationCity}` : ''}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{job.department}</div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{job.description}</p>
              </Link>
            </li>
          ))}
          {jobs.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No matching roles right now. Try clearing filters or check back later.
            </li>
          )}
        </ul>
      </main>
    </>
  );
}
