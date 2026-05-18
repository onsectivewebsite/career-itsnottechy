import fs from 'node:fs';
import path from 'node:path';
import { interpolate, wrapInLayout } from './render';

// === Data shapes per template ===

export type TemplateData = {
  'invite-staff':           { name: string; roleLabel: string; acceptUrl: string };
  'welcome-candidate':      { name: string; dashboardUrl: string };
  'password-reset':         { name: string; resetUrl: string };
  'application-received':   { name: string; jobTitle: string; dashboardUrl: string };
  'application-status-changed': { name: string; jobTitle: string; stageLabel: string; stageBlurb: string; dashboardUrl: string };
  'offer-sent':                 { name: string; jobTitle: string; dashboardUrl: string };
  'referral-submitted':     { referrerName: string; candidateName: string; jobTitle: string; dashboardUrl: string };
  'referral-status-update': { referrerName: string; candidateName: string; jobTitle: string; stageLabel: string; dashboardUrl: string };
};

export type TemplateName = keyof TemplateData;

// === Subject lines ===

const subjects: { [K in TemplateName]: (data: TemplateData[K]) => string } = {
  'invite-staff':           () => "You're invited to ItsNotTechy Careers",
  'welcome-candidate':      () => 'Welcome to ItsNotTechy Careers',
  'password-reset':         () => 'Reset your ItsNotTechy Careers password',
  'application-received':   (data) => `We received your application: ${data.jobTitle}`,
  'application-status-changed': (data) => `${data.jobTitle}: ${data.stageLabel}`,
  'offer-sent':                 (data) => `An offer for ${data.jobTitle}`,
  'referral-submitted':     (data) => `Referral received: ${data.candidateName} for ${data.jobTitle}`,
  'referral-status-update': (data) => `${data.candidateName} update: ${data.stageLabel}`,
};

export function subjectFor<T extends TemplateName>(name: T, data: TemplateData[T]): string {
  return subjects[name](data);
}

// === Render ===

const cache = new Map<string, string>();

function loadTemplate(name: TemplateName): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const p = path.resolve(process.cwd(), 'src/emails/templates', `${name}.html`);
  const html = fs.readFileSync(p, 'utf8');
  cache.set(name, html);
  return html;
}

export function renderTemplate<T extends TemplateName>(
  name: T,
  data: TemplateData[T],
): string {
  const inner = interpolate(loadTemplate(name), data as unknown as Record<string, string>);
  return wrapInLayout(inner, { previewText: subjects[name](data) });
}
