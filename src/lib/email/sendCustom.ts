import { prisma } from '@/lib/prisma';
import { getTransport } from './transport';
import { wrapInLayout } from './render';
import { getSettings } from '@/lib/services/systemSettings';
import { sanitizeRichHtml } from '@/lib/richText';

async function fromAddress(): Promise<string> {
  const s = await getSettings();
  const name = process.env.SMTP_FROM_NAME ?? s.defaultSenderName;
  const email = process.env.SMTP_FROM_EMAIL ?? 'info@itsnottechy.com';
  return `${name} <${email}>`;
}

export type SendCustomEmailArgs = {
  to: string;
  subject: string;
  /** HTML body; will be sanitised and wrapped in the brand layout. */
  html: string;
  /** Optional id of the EmailTemplate the body was based on. Recorded in the EmailLog payload. */
  sourceTemplateId?: string;
};

/** Send a one-off HR-authored email. Never throws — mirrors the sendEmail contract. */
export async function sendCustomEmail(args: SendCustomEmailArgs): Promise<void> {
  const safeBody = sanitizeRichHtml(args.html);
  const fullHtml = wrapInLayout(safeBody, { previewText: args.subject });

  let logId: string | null = null;
  try {
    const log = await prisma.emailLog.create({
      data: {
        toEmail: args.to,
        subject: args.subject,
        template: 'hr-custom',
        payload: { sourceTemplateId: args.sourceTemplateId ?? null },
        status: 'QUEUED',
      },
    });
    logId = log.id;

    await getTransport().sendMail({
      from: await fromAddress(),
      to: args.to,
      subject: args.subject,
      html: fullHtml,
    });

    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      try {
        await prisma.emailLog.update({
          where: { id: logId },
          data: { status: 'FAILED', error: message },
        });
      } catch {
        // intentional: never throw from sendCustomEmail
      }
    }
    // eslint-disable-next-line no-console
    console.error(`[email] custom send failed (to=${args.to}): ${message}`);
  }
}
