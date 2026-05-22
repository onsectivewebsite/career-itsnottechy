import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

/** Turn the current candidate's job alerts on or off. Upsert keyed on userId as a safety net. */
export async function setJobAlerts(args: {
  candidateUserId: string;
  enabled: boolean;
}): Promise<void> {
  await prisma.candidateProfile.upsert({
    where: { userId: args.candidateUserId },
    update: { jobAlertsEnabled: args.enabled },
    create: { userId: args.candidateUserId, jobAlertsEnabled: args.enabled },
  });
}

/** Email every alerts-enabled candidate about a newly published job. Returns the count notified. */
export async function notifyNewJob(job: { id: string; title: string }): Promise<number> {
  const subscribers = await prisma.candidateProfile.findMany({
    where: { jobAlertsEnabled: true },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const sub of subscribers) {
    await sendEmail({
      to: sub.user.email,
      template: 'job-alert',
      data: {
        name: sub.user.name,
        jobTitle: job.title,
        jobUrl: `${process.env.APP_URL ?? ''}/jobs/${job.id}`,
      },
    });
  }
  return subscribers.length;
}
