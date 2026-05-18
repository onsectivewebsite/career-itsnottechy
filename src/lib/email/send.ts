import { prisma } from '@/lib/prisma';
import { getTransport } from './transport';
import { renderTemplate, subjectFor, type TemplateData, type TemplateName } from './templates';

export type Attachment = {
  filename: string;
  content: string | Buffer;
  contentType: string;
};

export type SendEmailArgs<T extends TemplateName> = {
  to: string;
  template: T;
  data: TemplateData[T];
  attachments?: Attachment[];
};

function fromAddress(): string {
  const name = process.env.SMTP_FROM_NAME ?? 'ItsNotTechy Careers';
  const email = process.env.SMTP_FROM_EMAIL ?? 'info@itsnottechy.com';
  return `${name} <${email}>`;
}

/**
 * Strip bearer tokens from URL-shaped fields before persisting to EmailLog.
 * EmailLog rows live indefinitely; the tokens inside them become a credential
 * leak risk if a row is ever exfiltrated or shoulder-surfed from an admin viewer.
 */
function redactPayload(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === 'string' && /url$/i.test(k)) {
      out[k] = v.replace(/\/(invite|reset)\/[^/?#]+/, '/$1/<redacted>');
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function sendEmail<T extends TemplateName>(args: SendEmailArgs<T>): Promise<void> {
  let logId: string | null = null;
  try {
    const subject = subjectFor(args.template, args.data);
    const html = renderTemplate(args.template, args.data);

    const log = await prisma.emailLog.create({
      data: {
        toEmail: args.to,
        subject,
        template: args.template,
        payload: redactPayload(args.data) as object,
        status: 'QUEUED',
      },
    });
    logId = log.id;

    await getTransport().sendMail({
      from: fromAddress(),
      to: args.to,
      subject,
      html,
      attachments: args.attachments,
    });

    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (logId) {
      // Try to record the failure on the QUEUED row. If THIS update also
      // fails (DB really down), swallow to honor the never-throws contract.
      try {
        await prisma.emailLog.update({
          where: { id: logId },
          data: { status: 'FAILED', error: message },
        });
      } catch {
        // intentional: never throw from sendEmail
      }
    }

    // eslint-disable-next-line no-console
    console.error(`[email] send failed (template=${args.template}, to=${args.to}): ${message}`);
  }
}
