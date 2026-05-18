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

export async function sendEmail<T extends TemplateName>(args: SendEmailArgs<T>): Promise<void> {
  const subject = subjectFor(args.template, args.data);
  const html = renderTemplate(args.template, args.data);

  const log = await prisma.emailLog.create({
    data: {
      toEmail: args.to,
      subject,
      template: args.template,
      payload: args.data as object,
      status: 'QUEUED',
    },
  });

  try {
    await getTransport().sendMail({
      from: fromAddress(),
      to: args.to,
      subject,
      html,
      attachments: args.attachments,
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: err instanceof Error ? err.message : String(err) },
    });
  }
}
