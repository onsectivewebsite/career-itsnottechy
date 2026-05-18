# Phase 1B — Auth Flows, Middleware, and Email Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up NextAuth credentials, the email-sending pipeline (Hostinger SMTP via Nodemailer with EMAIL_TEST_MODE), route-protection middleware, candidate self-registration, staff invite, password reset request + confirmation, and login + logout. By the end, a candidate can register and log in, and a script can mint an invite link a staff member can use to set their password.

**Architecture:** NextAuth JWT-strategy session with a custom Credentials provider that calls `verifyPassword`. Server actions (not API routes) for auth mutations. `src/middleware.ts` enforces path-prefix RBAC. `src/lib/email.ts` is the single egress point for email; templates live in `src/emails/templates/` rendered with a minimal mustache-style interpolator (no external template engine).

**Tech Stack:** Same as 1A plus `nodemailer`, `next-auth` (already installed).

**Prerequisites:** Phase 1A complete. `npm test` is green. Postgres dev + test DBs are up.

---

## Task 14: Email rendering primitives

**Files:**
- Create: `src/lib/email/render.ts`, `src/lib/email/render.test.ts`, `src/emails/layouts/base.html`

Tiny mustache-like interpolator (`{{var}}` → value, with HTML escaping) and a `wrapInLayout(innerHtml, vars)` helper. We deliberately avoid a templating dep — the surface area is small.

- [ ] **Step 1: Write failing tests**

`src/lib/email/render.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { interpolate, wrapInLayout, escapeHtml } from './render';

describe('escapeHtml', () => {
  it('escapes &<>"\'', () => {
    expect(escapeHtml(`<a href="x">'foo'</a>&amp;`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;foo&#39;&lt;/a&gt;&amp;amp;',
    );
  });
});

describe('interpolate', () => {
  it('substitutes {{var}} with HTML-escaped values', () => {
    const out = interpolate('Hi {{name}}!', { name: '<Alice>' });
    expect(out).toBe('Hi &lt;Alice&gt;!');
  });
  it('substitutes {{{var}}} with raw values', () => {
    const out = interpolate('{{{link}}}', { link: '<a>x</a>' });
    expect(out).toBe('<a>x</a>');
  });
  it('leaves unknown tokens empty', () => {
    expect(interpolate('Hi {{name}}!', {})).toBe('Hi !');
  });
  it('handles multiple vars', () => {
    expect(interpolate('{{a}} {{b}}', { a: '1', b: '2' })).toBe('1 2');
  });
});

describe('wrapInLayout', () => {
  it('embeds inner HTML inside the base layout, with brand vars', () => {
    const html = wrapInLayout('<p>Hello</p>', { previewText: 'Test' });
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('ItsNotTechy Careers');
    expect(html).toContain('Test'); // preview text
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/email/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the renderer**

`src/lib/email/render.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolate(template: string, vars: Record<string, string>): string {
  // {{{x}}} is raw, {{x}} is escaped. Process triple-brace first.
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => escapeHtml(vars[k] ?? ''));
}

let cachedLayout: string | null = null;

function loadLayout(): string {
  if (cachedLayout !== null) return cachedLayout;
  const p = path.resolve(process.cwd(), 'src/emails/layouts/base.html');
  cachedLayout = fs.readFileSync(p, 'utf8');
  return cachedLayout;
}

export function wrapInLayout(innerHtml: string, vars: Record<string, string> = {}): string {
  return interpolate(loadLayout(), { ...vars, body: '' }).replace('{{{body}}}', innerHtml);
}
```

> Note: `loadLayout` reads from disk synchronously and caches. Templates are static at deploy time, so this is safe.

- [ ] **Step 4: Create the base layout**

`src/emails/layouts/base.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>ItsNotTechy Careers</title>
    <style>
      body { margin: 0; background: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #1e293b; }
      .preview { display: none; max-height: 0; overflow: hidden; }
      .container { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
      .card { background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 28px; }
      .brand { font-size: 20px; font-weight: 700; color: #1e3a8a; margin-bottom: 18px; }
      .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; }
      .muted { color: #64748b; font-size: 13px; margin-top: 24px; }
      a { color: #2563eb; }
      p { line-height: 1.55; }
    </style>
  </head>
  <body>
    <span class="preview">{{previewText}}</span>
    <div class="container">
      <div class="brand">ItsNotTechy Careers</div>
      <div class="card">
        {{{body}}}
      </div>
      <p class="muted">
        You're receiving this because you have an account at ItsNotTechy Careers.<br />
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Run — should pass**

Run: `npm test -- src/lib/email/render.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/ src/emails/
git commit -m "feat(email): add interpolator, base layout, and HTML escaping"
```

---

## Task 15: SMTP transport with EMAIL_TEST_MODE switch

**Files:**
- Create: `src/lib/email/transport.ts`, `src/lib/email/transport.test.ts`

`getTransport()` returns either a real nodemailer transport (Hostinger SMTP) or a fake one that records sends in memory and writes to console. The choice is `EMAIL_TEST_MODE === 'true'`.

- [ ] **Step 1: Write failing tests**

`src/lib/email/transport.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  getTransport,
  __resetTransportForTests,
  __recordedSendsForTests,
} from './transport';

afterEach(() => __resetTransportForTests());

describe('getTransport in EMAIL_TEST_MODE', () => {
  it('returns a fake transport that records sends', async () => {
    process.env.EMAIL_TEST_MODE = 'true';
    const t = getTransport();
    await t.sendMail({
      from: 'a@x.com',
      to: 'b@x.com',
      subject: 'hi',
      html: '<p>hi</p>',
    });
    const recorded = __recordedSendsForTests();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      to: 'b@x.com',
      subject: 'hi',
    });
  });
});
```

> We do not test the live SMTP path. That requires a network connection and credentials and would be an integration test against a real provider.

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/email/transport.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/email/transport.ts`:
```ts
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
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/email/transport.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/transport.ts src/lib/email/transport.test.ts
git commit -m "feat(email): add SMTP transport with EMAIL_TEST_MODE fake recorder"
```

---

## Task 16: Template registry — first three templates (Phase 1B emails)

**Files:**
- Create: `src/emails/templates/invite-staff.html`, `src/emails/templates/welcome-candidate.html`, `src/emails/templates/password-reset.html`
- Create: `src/lib/email/templates.ts`, `src/lib/email/templates.test.ts`

Each template has its own typed data shape. We register them centrally so `sendEmail` can look up by name with type safety.

- [ ] **Step 1: Create the three HTML templates**

`src/emails/templates/invite-staff.html`:
```html
<p>Hi {{name}},</p>
<p>You've been invited to join <strong>ItsNotTechy Careers</strong> as a {{roleLabel}}.</p>
<p>Set your password to get started:</p>
<p><a class="btn" href="{{acceptUrl}}">Set my password</a></p>
<p>This link expires in 7 days.</p>
<p>If you weren't expecting this invitation, you can ignore this email.</p>
```

`src/emails/templates/welcome-candidate.html`:
```html
<p>Hi {{name}},</p>
<p>Welcome to <strong>ItsNotTechy Careers</strong>. Your account is ready.</p>
<p><a class="btn" href="{{dashboardUrl}}">Open my dashboard</a></p>
<p>Browse our open roles and apply when you find a match. We'll keep you posted as your application moves forward.</p>
```

`src/emails/templates/password-reset.html`:
```html
<p>Hi {{name}},</p>
<p>We received a request to reset your ItsNotTechy Careers password.</p>
<p><a class="btn" href="{{resetUrl}}">Choose a new password</a></p>
<p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
```

- [ ] **Step 2: Write failing tests for the registry**

`src/lib/email/templates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderTemplate, subjectFor } from './templates';

describe('renderTemplate', () => {
  it('renders invite-staff with substitutions and the layout', () => {
    const html = renderTemplate('invite-staff', {
      name: 'Alice',
      roleLabel: 'HR Manager',
      acceptUrl: 'https://x.com/invite/abc',
    });
    expect(html).toContain('Alice');
    expect(html).toContain('HR Manager');
    expect(html).toContain('https://x.com/invite/abc');
    expect(html).toContain('ItsNotTechy Careers'); // from layout
  });

  it('renders welcome-candidate', () => {
    const html = renderTemplate('welcome-candidate', {
      name: 'Bob',
      dashboardUrl: 'https://x.com/dashboard/candidate',
    });
    expect(html).toContain('Bob');
    expect(html).toContain('https://x.com/dashboard/candidate');
  });

  it('renders password-reset', () => {
    const html = renderTemplate('password-reset', {
      name: 'Carol',
      resetUrl: 'https://x.com/reset/xyz',
    });
    expect(html).toContain('Carol');
    expect(html).toContain('https://x.com/reset/xyz');
  });

  it('HTML-escapes user data', () => {
    const html = renderTemplate('welcome-candidate', {
      name: '<script>',
      dashboardUrl: 'https://x.com/d',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('subjectFor', () => {
  it('returns subjects per template', () => {
    expect(subjectFor('invite-staff', { name: 'A', roleLabel: 'X', acceptUrl: '' }))
      .toBe('You\'re invited to ItsNotTechy Careers');
    expect(subjectFor('welcome-candidate', { name: 'A', dashboardUrl: '' }))
      .toBe('Welcome to ItsNotTechy Careers');
    expect(subjectFor('password-reset', { name: 'A', resetUrl: '' }))
      .toBe('Reset your ItsNotTechy Careers password');
  });
});
```

- [ ] **Step 3: Run — should fail**

Run: `npm test -- src/lib/email/templates.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the registry**

`src/lib/email/templates.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { interpolate, wrapInLayout } from './render';

// === Data shapes per template ===

export type TemplateData = {
  'invite-staff':       { name: string; roleLabel: string; acceptUrl: string };
  'welcome-candidate':  { name: string; dashboardUrl: string };
  'password-reset':     { name: string; resetUrl: string };
};

export type TemplateName = keyof TemplateData;

// === Subject lines ===

const subjects: { [K in TemplateName]: (data: TemplateData[K]) => string } = {
  'invite-staff':      () => "You're invited to ItsNotTechy Careers",
  'welcome-candidate': () => 'Welcome to ItsNotTechy Careers',
  'password-reset':    () => 'Reset your ItsNotTechy Careers password',
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
```

- [ ] **Step 5: Run — should pass**

Run: `npm test -- src/lib/email/templates.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/emails/templates/ src/lib/email/templates.ts src/lib/email/templates.test.ts
git commit -m "feat(email): add first three templates and typed render registry"
```

---

## Task 17: `sendEmail` — the single egress

**Files:**
- Create: `src/lib/email/send.ts`, `src/lib/email/send.test.ts`, `src/lib/email/index.ts`

Combines transport + render + EmailLog. Writes a `QUEUED` row, attempts the send, updates the row to `SENT` or `FAILED`. Never throws to callers — caller flow must not break on email failure.

- [ ] **Step 1: Write failing tests**

`src/lib/email/send.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { sendEmail } from './send';
import { __recordedSendsForTests, __resetTransportForTests } from './transport';

beforeEach(async () => {
  process.env.EMAIL_TEST_MODE = 'true';
  __resetTransportForTests();
  await resetDb();
});

afterEach(() => __resetTransportForTests());

describe('sendEmail', () => {
  it('writes an EmailLog row with status SENT in test mode', async () => {
    await sendEmail({
      to: 'a@x.com',
      template: 'welcome-candidate',
      data: { name: 'Alice', dashboardUrl: 'http://x' },
    });

    const recorded = __recordedSendsForTests();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.to).toBe('a@x.com');

    const logs = await prisma.emailLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      toEmail: 'a@x.com',
      subject: 'Welcome to ItsNotTechy Careers',
      template: 'welcome-candidate',
      status: 'SENT',
    });
    expect(logs[0]?.sentAt).not.toBeNull();
  });

  it('records FAILED + error and does not throw when transport fails', async () => {
    process.env.EMAIL_TEST_MODE = 'false';
    process.env.SMTP_HOST = 'invalid-host-that-does-not-exist.local';
    process.env.SMTP_PORT = '1';
    process.env.SMTP_USER = 'x';
    process.env.SMTP_PASS = 'x';
    __resetTransportForTests();

    await expect(
      sendEmail({
        to: 'a@x.com',
        template: 'welcome-candidate',
        data: { name: 'A', dashboardUrl: 'http://x' },
      }),
    ).resolves.toBeUndefined();

    const log = await prisma.emailLog.findFirst();
    expect(log?.status).toBe('FAILED');
    expect(log?.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/email/send.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `sendEmail`**

`src/lib/email/send.ts`:
```ts
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
```

- [ ] **Step 4: Add the public barrel**

`src/lib/email/index.ts`:
```ts
export { sendEmail, type SendEmailArgs, type Attachment } from './send';
export { type TemplateName, type TemplateData } from './templates';
```

- [ ] **Step 5: Run — should pass**

Run: `npm test -- src/lib/email/send.test.ts`
Expected: 2 passed (the failure test takes a few seconds while it actually fails to dial out).

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/send.ts src/lib/email/send.test.ts src/lib/email/index.ts
git commit -m "feat(email): add sendEmail() with EmailLog and failure-safe behavior"
```

---

## Task 18: NextAuth configuration

**Files:**
- Create: `src/lib/auth/options.ts`, `src/lib/auth/session.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`

NextAuth with the Credentials provider, JWT strategy. `session.user` carries `{ id, email, name, role }`. We expose `getSessionUser()` for server code.

- [ ] **Step 1: Augment NextAuth types**

`src/types/next-auth.d.ts`:
```ts
import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    } & DefaultSession['user'];
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
```

- [ ] **Step 2: Implement NextAuth options**

`src/lib/auth/options.ts`:
```ts
import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !user.isActive) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
```

- [ ] **Step 3: Implement `getSessionUser()` for server code**

`src/lib/auth/session.ts`:
```ts
import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import type { SessionUser } from '@/lib/rbac';

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}
```

- [ ] **Step 4: NextAuth route handler**

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/options';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 5: Smoke test that types compile and module loads**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (this exercises the route).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/ src/types/next-auth.d.ts src/app/api/auth/
git commit -m "feat(auth): add NextAuth credentials provider with JWT session"
```

---

## Task 19: Route-protection middleware

**Files:**
- Create: `src/middleware.ts`, `src/middleware.test.ts`

Path-prefix RBAC enforced at the edge. Hits `getToken()` from `next-auth/jwt` (works in Edge runtime). Public paths pass through; dashboard prefixes require matching roles; unauthenticated users on protected routes get redirected to `/login?returnTo=...`.

- [ ] **Step 1: Write failing tests**

`src/middleware.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getToken before importing the middleware so its module-level imports use the mock.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import { middleware } from './middleware';

function req(pathname: string): NextRequest {
  return new NextRequest(new Request(`http://localhost:3000${pathname}`));
}

describe('middleware', () => {
  it('lets public paths through', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(req('/'));
    expect(res.status).toBe(200);
  });

  it('redirects unauthed user from /dashboard/* to /login with returnTo', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(307);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/login');
    expect(loc).toContain('returnTo=%2Fdashboard%2Fhr');
  });

  it('forbids EMPLOYEE accessing /dashboard/hr', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'EMPLOYEE' });
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/403');
  });

  it('allows HR_MANAGER on /dashboard/hr', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'HR_MANAGER' });
    const res = await middleware(req('/dashboard/hr'));
    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN everywhere under /dashboard', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'SUPER_ADMIN' });
    for (const p of [
      '/dashboard/admin', '/dashboard/hr', '/dashboard/manager',
      '/dashboard/employee', '/dashboard/candidate',
    ]) {
      const res = await middleware(req(p));
      expect(res.status, p).toBe(200);
    }
  });

  it('redirects /dashboard root to the per-role dashboard', async () => {
    (getToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', role: 'CANDIDATE' });
    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard/candidate');
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/middleware.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement middleware**

`src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { Role } from '@prisma/client';

const PREFIX_ALLOWED: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/dashboard/admin',     roles: ['SUPER_ADMIN'] },
  { prefix: '/dashboard/hr',        roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
  { prefix: '/dashboard/manager',   roles: ['SUPER_ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/employee',  roles: ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'] },
  { prefix: '/dashboard/candidate', roles: ['SUPER_ADMIN', 'CANDIDATE'] },
];

function dashboardFor(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/dashboard/admin';
    case 'HR_MANAGER':  return '/dashboard/hr';
    case 'MANAGER':     return '/dashboard/manager';
    case 'EMPLOYEE':    return '/dashboard/employee';
    case 'CANDIDATE':   return '/dashboard/candidate';
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Only intercept /dashboard*. Everything else passes through.
  if (!pathname.startsWith('/dashboard')) return NextResponse.next();

  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as
    | { id: string; role: Role }
    | null;

  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(dashboardFor(token.role), req.url));
  }

  const match = PREFIX_ALLOWED.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'));
  if (match && !match.roles.includes(token.role)) {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/middleware.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat(auth): add route-protection middleware with role-based dashboard prefixes"
```

---

## Task 20: User service — candidate self-registration

**Files:**
- Create: `src/lib/services/userService.ts`, `src/lib/services/userService.test.ts`

Service-layer function `registerCandidate({ email, password, name })` creates `User{role:CANDIDATE}` + `CandidateProfile`, fires `welcome-candidate` email, records audit. Reused by the server action in the next task.

- [ ] **Step 1: Write failing tests**

`src/lib/services/userService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import { registerCandidate } from './userService';
import { verifyPassword } from '@/lib/password';
import { __recordedSendsForTests, __resetTransportForTests } from '@/lib/email/transport';

beforeEach(async () => {
  process.env.EMAIL_TEST_MODE = 'true';
  __resetTransportForTests();
  await resetDb();
});

describe('registerCandidate', () => {
  it('creates a User+CandidateProfile, hashes the password, sends welcome email', async () => {
    const result = await registerCandidate({
      email: 'alice@example.com',
      password: 'Hunter2pass',
      name: 'Alice',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { candidateProfile: true },
    });
    expect(user?.role).toBe('CANDIDATE');
    expect(user?.candidateProfile).not.toBeNull();
    expect(await verifyPassword('Hunter2pass', user!.passwordHash)).toBe(true);

    expect(__recordedSendsForTests()).toHaveLength(1);
    expect(__recordedSendsForTests()[0]?.to).toBe('alice@example.com');

    const audits = await prisma.auditLog.findMany();
    expect(audits.find((a) => a.action === 'USER_REGISTERED')).toBeDefined();
  });

  it('lowercases the email', async () => {
    const r = await registerCandidate({
      email: 'BOB@Example.com', password: 'Hunter2pass', name: 'Bob',
    });
    expect(r.ok).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: 'bob@example.com' } });
    expect(user).not.toBeNull();
  });

  it('returns EMAIL_TAKEN when email already exists', async () => {
    await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' });
    const r = await registerCandidate({ email: 'a@x.com', password: 'Hunter2pass', name: 'A2' });
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/services/userService.ts`:
```ts
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'EMAIL_TAKEN' };

export async function registerCandidate(input: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterResult> {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: 'EMAIL_TAKEN' };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      role: 'CANDIDATE',
      candidateProfile: { create: {} },
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: 'CANDIDATE' },
  });

  await sendEmail({
    to: user.email,
    template: 'welcome-candidate',
    data: {
      name: user.name,
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, userId: user.id };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/userService.ts src/lib/services/userService.test.ts
git commit -m "feat(service): add registerCandidate with audit + welcome email"
```

---

## Task 21: User service — staff invite

**Files:**
- Modify: `src/lib/services/userService.ts`
- Modify: `src/lib/services/userService.test.ts`

`inviteStaff({ email, name, role, employeeData, invitedByUserId })`. Creates `User{passwordHash:null}` + `Employee` row, issues invite token, fires `invite-staff` email, audits.

- [ ] **Step 1: Add failing tests (extend existing test file)**

Append to `src/lib/services/userService.test.ts`:
```ts
import { inviteStaff } from './userService';

describe('inviteStaff', () => {
  beforeEach(async () => { await resetDb(); __resetTransportForTests(); });

  it('creates a User (no password) + Employee + invite token; sends email', async () => {
    const inviter = await prisma.user.create({
      data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' },
    });
    const r = await inviteStaff({
      email: 'new@example.com',
      name: 'New Hire',
      role: 'EMPLOYEE',
      employeeData: {
        employeeCode: 'E001',
        department: 'Engineering',
        title: 'Software Engineer',
        hireDate: new Date('2026-06-01'),
        managerId: null,
      },
      invitedByUserId: inviter.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const user = await prisma.user.findUnique({
      where: { id: r.userId },
      include: { employee: true, inviteTokens: true },
    });
    expect(user?.role).toBe('EMPLOYEE');
    expect(user?.passwordHash).toBeNull();
    expect(user?.employee?.employeeCode).toBe('E001');
    expect(user?.inviteTokens).toHaveLength(1);
    expect(user?.inviteTokens[0]?.token).toBeTruthy();

    const sends = __recordedSendsForTests();
    expect(sends).toHaveLength(1);
    expect(sends[0]?.to).toBe('new@example.com');
    expect(sends[0]?.html).toContain(user!.inviteTokens[0]!.token);

    const audits = await prisma.auditLog.findMany();
    expect(audits.find((a) => a.action === 'STAFF_INVITED')).toBeDefined();
  });

  it('rejects when email already exists', async () => {
    await prisma.user.create({ data: { email: 'dup@x.com', name: 'D', role: 'EMPLOYEE' } });
    const r = await inviteStaff({
      email: 'dup@x.com',
      name: 'X',
      role: 'EMPLOYEE',
      employeeData: { employeeCode: 'E002', department: 'X', title: 'X', hireDate: new Date(), managerId: null },
      invitedByUserId: 'system',
    });
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });

  it('rejects when employeeCode is taken', async () => {
    await prisma.user.create({
      data: {
        email: 'first@x.com', name: 'First', role: 'EMPLOYEE',
        employee: { create: { employeeCode: 'E099', department: 'X', title: 'X', hireDate: new Date() } },
      },
    });
    const r = await inviteStaff({
      email: 'second@x.com',
      name: 'Second',
      role: 'EMPLOYEE',
      employeeData: { employeeCode: 'E099', department: 'X', title: 'X', hireDate: new Date(), managerId: null },
      invitedByUserId: 'system',
    });
    expect(r).toEqual({ ok: false, reason: 'EMPLOYEE_CODE_TAKEN' });
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement (append to `src/lib/services/userService.ts`)**

```ts
import type { Role } from '@prisma/client';
import { issueInviteToken } from '@/lib/tokens';

const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  HR_MANAGER:  'HR Manager',
  MANAGER:     'Manager',
  EMPLOYEE:    'Employee',
  CANDIDATE:   'Candidate',
};

export type InviteStaffResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'EMAIL_TAKEN' | 'EMPLOYEE_CODE_TAKEN' };

export async function inviteStaff(input: {
  email: string;
  name: string;
  role: Extract<Role, 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE'>;
  employeeData: {
    employeeCode: string;
    department: string;
    title: string;
    hireDate: Date;
    managerId: string | null;
  };
  invitedByUserId: string;
}): Promise<InviteStaffResult> {
  const email = input.email.toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, reason: 'EMAIL_TAKEN' };
  }
  if (await prisma.employee.findUnique({ where: { employeeCode: input.employeeData.employeeCode } })) {
    return { ok: false, reason: 'EMPLOYEE_CODE_TAKEN' };
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: null,
      name: input.name,
      role: input.role,
      employee: {
        create: {
          employeeCode: input.employeeData.employeeCode,
          department: input.employeeData.department,
          title: input.employeeData.title,
          hireDate: input.employeeData.hireDate,
          managerId: input.employeeData.managerId,
        },
      },
    },
  });

  const token = await issueInviteToken(user.id);

  await recordAudit({
    actorUserId: input.invitedByUserId,
    action: 'STAFF_INVITED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: input.role, email },
  });

  await sendEmail({
    to: user.email,
    template: 'invite-staff',
    data: {
      name: user.name,
      roleLabel: roleLabel[input.role],
      acceptUrl: `${process.env.APP_URL ?? ''}/invite/${token}`,
    },
  });

  return { ok: true, userId: user.id, token };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: all (registerCandidate + inviteStaff) tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/userService.ts src/lib/services/userService.test.ts
git commit -m "feat(service): add inviteStaff with employee row, invite token, email"
```

---

## Task 22: User service — accept invite and reset password

**Files:**
- Modify: `src/lib/services/userService.ts`
- Modify: `src/lib/services/userService.test.ts`

Two more functions: `acceptInvite({ token, password })` and `setNewPasswordWithResetToken({ token, password })`. Both consume the token, hash the password, set on the user.

- [ ] **Step 1: Add failing tests**

Append to `src/lib/services/userService.test.ts`:
```ts
import {
  acceptInvite,
  setNewPasswordWithResetToken,
  requestPasswordReset,
} from './userService';
import { issueInviteToken, issuePasswordResetToken } from '@/lib/tokens';

describe('acceptInvite', () => {
  beforeEach(async () => { await resetDb(); __resetTransportForTests(); });

  it('sets password and marks token used', async () => {
    const u = await prisma.user.create({
      data: { email: 'inv@x.com', name: 'Inv', role: 'EMPLOYEE' },
    });
    const token = await issueInviteToken(u.id);

    const r = await acceptInvite({ token, password: 'Hunter2pass' });
    expect(r).toEqual({ ok: true, userId: u.id });

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordHash).not.toBeNull();
    expect(await verifyPassword('Hunter2pass', updated!.passwordHash)).toBe(true);

    const tokenRow = await prisma.inviteToken.findUnique({ where: { token } });
    expect(tokenRow?.usedAt).not.toBeNull();
  });

  it('fails on bad token', async () => {
    const r = await acceptInvite({ token: 'nope', password: 'Hunter2pass' });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });
});

describe('requestPasswordReset', () => {
  beforeEach(async () => { await resetDb(); __resetTransportForTests(); });

  it('sends reset email when user exists', async () => {
    await prisma.user.create({
      data: { email: 'a@x.com', name: 'A', role: 'CANDIDATE', passwordHash: 'x' },
    });
    await requestPasswordReset('a@x.com');
    expect(__recordedSendsForTests()).toHaveLength(1);
    expect(__recordedSendsForTests()[0]?.to).toBe('a@x.com');

    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens).toHaveLength(1);
  });

  it('does NOT reveal whether the user exists (no error, no email)', async () => {
    await requestPasswordReset('ghost@x.com');
    expect(__recordedSendsForTests()).toHaveLength(0);
    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens).toHaveLength(0);
  });
});

describe('setNewPasswordWithResetToken', () => {
  beforeEach(async () => { await resetDb(); });

  it('updates password and consumes token', async () => {
    const u = await prisma.user.create({
      data: { email: 'a@x.com', name: 'A', role: 'CANDIDATE', passwordHash: 'old' },
    });
    const token = await issuePasswordResetToken(u.id);
    const r = await setNewPasswordWithResetToken({ token, password: 'NewPass123' });
    expect(r).toEqual({ ok: true, userId: u.id });
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(await verifyPassword('NewPass123', updated!.passwordHash)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: FAIL on new tests.

- [ ] **Step 3: Implement (append to `src/lib/services/userService.ts`)**

```ts
import { consumeInviteToken, consumePasswordResetToken, issuePasswordResetToken } from '@/lib/tokens';

export type AcceptInviteResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export async function acceptInvite(input: {
  token: string;
  password: string;
}): Promise<AcceptInviteResult> {
  const r = await consumeInviteToken(input.token);
  if (!r.ok) return r;
  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: r.userId }, data: { passwordHash } });
  await recordAudit({
    actorUserId: r.userId,
    action: 'INVITE_ACCEPTED',
    entityType: 'User',
    entityId: r.userId,
  });
  return { ok: true, userId: r.userId };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const lower = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: lower } });
  // Silent success when user doesn't exist — avoids account enumeration.
  if (!user || !user.isActive) return;

  const token = await issuePasswordResetToken(user.id);
  await sendEmail({
    to: user.email,
    template: 'password-reset',
    data: {
      name: user.name,
      resetUrl: `${process.env.APP_URL ?? ''}/reset/${token}`,
    },
  });
}

export type SetNewPasswordResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED' };

export async function setNewPasswordWithResetToken(input: {
  token: string;
  password: string;
}): Promise<SetNewPasswordResult> {
  const r = await consumePasswordResetToken(input.token);
  if (!r.ok) return r;
  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: r.userId }, data: { passwordHash } });
  await recordAudit({
    actorUserId: r.userId,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: r.userId,
  });
  return { ok: true, userId: r.userId };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/services/userService.test.ts`
Expected: all userService tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/userService.ts src/lib/services/userService.test.ts
git commit -m "feat(service): add acceptInvite, requestPasswordReset, setNewPasswordWithResetToken"
```

---

## Task 23: Validation schemas for auth forms

**Files:**
- Create: `src/lib/validation/auth.ts`, `src/lib/validation/auth.test.ts`

Form-level Zod schemas reused by server actions and forms.

- [ ] **Step 1: Write failing tests**

`src/lib/validation/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  registerCandidateSchema,
  loginSchema,
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
} from './auth';

describe('registerCandidateSchema', () => {
  it('accepts valid input', () => {
    expect(
      registerCandidateSchema.parse({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' }),
    ).toEqual({ email: 'a@x.com', password: 'Hunter2pass', name: 'A' });
  });
  it('rejects invalid email', () => {
    expect(() =>
      registerCandidateSchema.parse({ email: 'no', password: 'Hunter2pass', name: 'A' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('lowercases email and allows any password length', () => {
    expect(loginSchema.parse({ email: 'A@X.com', password: 'x' })).toEqual({
      email: 'a@x.com', password: 'x',
    });
  });
});

describe('acceptInviteSchema', () => {
  it('requires a non-empty token and a valid password', () => {
    expect(() => acceptInviteSchema.parse({ token: '', password: 'Hunter2pass' })).toThrow();
    expect(() => acceptInviteSchema.parse({ token: 't', password: 'short' })).toThrow();
    expect(acceptInviteSchema.parse({ token: 't', password: 'Hunter2pass' })).toEqual({
      token: 't', password: 'Hunter2pass',
    });
  });
});

describe('requestResetSchema', () => {
  it('lowercases email', () => {
    expect(requestResetSchema.parse({ email: 'A@X.com' })).toEqual({ email: 'a@x.com' });
  });
});

describe('resetPasswordSchema', () => {
  it('requires token and valid password', () => {
    expect(resetPasswordSchema.parse({ token: 't', password: 'Hunter2pass' })).toEqual({
      token: 't', password: 'Hunter2pass',
    });
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/validation/auth.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/validation/auth.ts`:
```ts
import { z } from 'zod';
import { emailSchema, passwordSchema, nameSchema } from './common';

export const registerCandidateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});
export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Missing token'),
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const requestResetSchema = z.object({
  email: emailSchema,
});
export type RequestResetInput = z.infer<typeof requestResetSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Missing token'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/validation/auth.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/auth.ts src/lib/validation/auth.test.ts
git commit -m "feat(validation): add zod schemas for auth forms"
```

---

## Task 24: Server actions for auth

**Files:**
- Create: `src/app/(auth)/actions.ts`

All four auth actions in one file (shared imports, small functions). UI in 1C consumes these.

- [ ] **Step 1: Implement**

`src/app/(auth)/actions.ts`:
```ts
'use server';

import { signIn } from 'next-auth/react';
import {
  registerCandidate,
  acceptInvite,
  requestPasswordReset,
  setNewPasswordWithResetToken,
} from '@/lib/services/userService';
import {
  registerCandidateSchema,
  acceptInviteSchema,
  requestResetSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';

type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: true };

export async function registerCandidateAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerCandidateSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await registerCandidate(parsed.data);
  if (!r.ok) {
    return { error: r.reason === 'EMAIL_TAKEN' ? 'That email is already in use.' : 'Registration failed.' };
  }
  return { ok: true };
}

export async function acceptInviteAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await acceptInvite(parsed.data);
  if (!r.ok) {
    return {
      error:
        r.reason === 'EXPIRED'      ? 'This invite link has expired.' :
        r.reason === 'ALREADY_USED' ? 'This invite link has already been used.' :
                                      'This invite link is invalid.',
    };
  }
  return { ok: true };
}

export async function requestResetAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await requestPasswordReset(parsed.data.email);
  // Always return success — don't reveal whether the address exists.
  return { ok: true };
}

export async function resetPasswordAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const r = await setNewPasswordWithResetToken(parsed.data);
  if (!r.ok) {
    return {
      error:
        r.reason === 'EXPIRED'      ? 'This reset link has expired.' :
        r.reason === 'ALREADY_USED' ? 'This reset link has already been used.' :
                                      'This reset link is invalid.',
    };
  }
  return { ok: true };
}
```

> Login itself is handled directly by NextAuth's `signIn('credentials', ...)` from the login form — no server action needed. The login UI lands in 1C.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/actions.ts
git commit -m "feat(auth): add server actions for register, invite-accept, password reset"
```

---

## Task 25: Full sweep + checkpoint

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: all tests pass (~60 tests now).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds. Warnings about pages without routes (auth dir has no UI yet — that's expected, it's just the actions file).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke-test sendEmail manually**

Run:
```bash
EMAIL_TEST_MODE=true npx tsx -e "
import { sendEmail } from './src/lib/email';
await sendEmail({ to: 'a@x.com', template: 'welcome-candidate', data: { name: 'A', dashboardUrl: 'http://x' } });
console.log('done');
"
```
Expected: prints `[email:test] → a@x.com  Welcome to ItsNotTechy Careers` then `done`. Check Prisma Studio: there should be an EmailLog row with status SENT.

- [ ] **Step 5: Stop**

Plan 1B complete. Move to plan 1C (UI shells, file upload, seed, deploy guide).

---

## Self-review notes (informational)

- `sendEmail` never throws — caller flows (register, invite, etc.) succeed even if SMTP is down. EmailLog row records the failure for retry/audit.
- `requestPasswordReset` is intentionally silent on missing email to prevent account enumeration. The action always returns success.
- `Role` mentioned in `inviteStaff` is constrained to invitable staff roles — Super Admin must be seeded, not invited.
- Server actions are colocated in the route group `(auth)` (parentheses → routing-neutral). UI pages added in 1C share that group.
- Middleware test mocks `getToken` at the module level — required because `next-auth/jwt` is imported at the top of `middleware.ts`.
- After this plan you have: NextAuth fully wired, middleware protecting `/dashboard/*`, all four auth flows working at the service+action layer. UI lives in 1C.
