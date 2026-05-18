import nodemailer, { type Transporter } from 'nodemailer';

type Recorded = {
  to: string;
  subject: string;
  html: string;
  attachments?: unknown[];
};

let cached: Transporter | null = null;
let recorded: Recorded[] = [];

function buildFakeTransport(): Transporter {
  // Minimal shape: implements only sendMail.
  return {
    async sendMail(opts: nodemailer.SendMailOptions) {
      const r: Recorded = {
        to: String(opts.to ?? ''),
        subject: String(opts.subject ?? ''),
        html: String(opts.html ?? ''),
        attachments: opts.attachments,
      };
      recorded.push(r);
      // eslint-disable-next-line no-console
      console.log(`[email:test] → ${r.to}  ${r.subject}`);
      return { accepted: [r.to], rejected: [], response: 'test-mode' } as nodemailer.SentMessageInfo;
    },
  } as unknown as Transporter;
}

function buildRealTransport(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export function getTransport(): Transporter {
  if (cached) return cached;
  cached = process.env.EMAIL_TEST_MODE === 'true' ? buildFakeTransport() : buildRealTransport();
  return cached;
}

// === Test-only helpers ===

export function __resetTransportForTests(): void {
  cached = null;
  recorded = [];
}

export function __recordedSendsForTests(): readonly Recorded[] {
  return recorded;
}
