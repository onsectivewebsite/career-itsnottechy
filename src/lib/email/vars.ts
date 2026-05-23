export type EmailVars = {
  candidateName: string;
  jobTitle: string;
  stageLabel: string;
  dashboardUrl: string;
};

export type BuildVarsInput =
  | {
      kind: 'application';
      candidate: { name: string };
      job: { title: string };
      stageLabel: string;
    }
  | {
      kind: 'standalone';
      candidate: { name: string };
      job?: { title: string };
    };

/** Returns the fixed-set variables used by HR email templates. */
export function buildEmailVars(input: BuildVarsInput): EmailVars {
  const dashboardUrl = `${process.env.APP_URL ?? ''}/dashboard/candidate`;
  if (input.kind === 'application') {
    return {
      candidateName: input.candidate.name,
      jobTitle: input.job.title,
      stageLabel: input.stageLabel,
      dashboardUrl,
    };
  }
  return {
    candidateName: input.candidate.name,
    jobTitle: input.job?.title ?? '',
    stageLabel: '',
    dashboardUrl,
  };
}
