# Phase 1C — UI Shells, File Upload, Seed, and Deploy Guide

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Phase 1 with: the public landing page, the four auth UI pages (login, register, invite-accept, reset-request, reset-confirm), five dashboard shells (one per role), file upload + auth-checked serving, a seed script, and a complete README with VPS deploy guide. After this plan, a fresh checkout can be deployed to a VPS using only the README.

**Architecture:** All UI in React Server Components except the few forms that need client state (login submit, password forms — wrapped in small `'use client'` components that use `useFormState` against the actions from 1B). UI primitives in `src/components/ui/`. File upload via `POST /api/upload` (multipart). File serving via `GET /api/files/[...path]` with per-entity auth checks (Phase 1 only validates session presence; Phase 2-5 extend with ownership checks per entity type as those entities exist).

**Tech Stack:** Same as 1A/1B.

**Prerequisites:** Plans 1A and 1B complete and committed. `npm test` is green. `npm run build` succeeds.

---

## Task 26: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Label.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Badge.tsx`, `src/components/ui/Alert.tsx`, `src/lib/cn.ts`

Tiny set of building blocks. No design system overengineering — Tailwind classes inline, `clsx` for variants.

- [ ] **Step 1: `cn` helper**

`src/lib/cn.ts`:
```ts
import clsx, { type ClassValue } from 'clsx';
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

- [ ] **Step 2: `Button`**

`src/components/ui/Button.tsx`:
```tsx
import { cn } from '@/lib/cn';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-400',
  ghost:     'bg-transparent text-slate-700 hover:bg-slate-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...rest} />
  );
});
```

- [ ] **Step 3: `Input` + `Label`**

`src/components/ui/Input.tsx`:
```tsx
import { cn } from '@/lib/cn';
import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, invalid, ...rest }, ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        invalid ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...rest}
    />
  );
});
```

`src/components/ui/Label.tsx`:
```tsx
import { cn } from '@/lib/cn';
import type { LabelHTMLAttributes } from 'react';

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-slate-700', className)} {...rest} />;
}
```

- [ ] **Step 4: `Card`, `Badge`, `Alert`**

`src/components/ui/Card.tsx`:
```tsx
import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white p-6 shadow-sm', className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-slate-900', className)} {...rest} />;
}
```

`src/components/ui/Badge.tsx`:
```tsx
import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-green-100 text-green-700',
  amber:   'bg-amber-100 text-amber-800',
  red:     'bg-red-100 text-red-700',
};

export function Badge({
  className, tone = 'neutral', ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}
      {...rest}
    />
  );
}
```

`src/components/ui/Alert.tsx`:
```tsx
import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';
const tones: Record<Tone, string> = {
  info:    'bg-blue-50 text-blue-900 border-blue-200',
  success: 'bg-green-50 text-green-900 border-green-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  error:   'bg-red-50 text-red-900 border-red-200',
};

export function Alert({
  className, tone = 'info', ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', tones[tone], className)} {...rest} />
  );
}
```

- [ ] **Step 5: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ src/lib/cn.ts
git commit -m "feat(ui): add primitive components (Button, Input, Card, Badge, Alert)"
```

---

## Task 27: Public landing page + navbar

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/PublicNav.tsx`

Real landing page replacing the placeholder. Public nav is a single component reused on public routes.

- [ ] **Step 1: PublicNav**

`src/components/PublicNav.tsx`:
```tsx
import Link from 'next/link';

export function PublicNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold text-brand-700">
          ItsNotTechy Careers
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/jobs" className="text-slate-700 hover:text-slate-900">
            Open roles
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Replace the placeholder landing**

`src/app/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Build what's next at ItsNotTechy.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            We're a small team building practical software. Browse open roles or
            create an account to track your applications.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/jobs">
              <Button size="lg">See open roles</Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="secondary">Create candidate account</Button>
            </Link>
          </div>
        </section>
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-4xl gap-8 px-6 py-16 sm:grid-cols-3">
            <Feature title="Real people, real reviews">
              Every application goes to a hiring manager. No black-box screening.
            </Feature>
            <Feature title="Transparent process">
              Track exactly where your application sits in the pipeline at any time.
            </Feature>
            <Feature title="Referrals welcome">
              Know someone who'd be a great fit? Existing team members can refer you in.
            </Feature>
          </div>
        </section>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">
            © {new Date().getFullYear()} ItsNotTechy.
          </div>
        </footer>
      </main>
    </>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{children}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify page boots**

Run: `npm run dev`. Visit http://localhost:3000. Expected: landing page renders. Stop with `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PublicNav.tsx src/app/page.tsx
git commit -m "feat(ui): add public landing page and navbar"
```

---

## Task 28: 403 and 404 pages

**Files:**
- Create: `src/app/403/page.tsx`, `src/app/not-found.tsx`

The middleware redirects unauthorized users to `/403`. Next.js renders `not-found.tsx` for missing routes.

- [ ] **Step 1: 403 page**

`src/app/403/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold text-brand-600">403</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">No access</h1>
        <p className="mt-4 text-slate-600">
          Your account doesn't have permission to view this page.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: 404 page**

`src/app/not-found.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-4 text-slate-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/403/ src/app/not-found.tsx
git commit -m "feat(ui): add 403 forbidden and 404 not-found pages"
```

---

## Task 29: Login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`

`page.tsx` is a server component that wraps a small `'use client'` form. The form calls `signIn('credentials', { redirect: false })` then routes to the post-login destination.

- [ ] **Step 1: Server page**

`src/app/(auth)/login/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in · ItsNotTechy Careers' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Sign in</CardTitle>
          <LoginForm returnTo={searchParams.returnTo} />
          <p className="mt-4 text-sm text-slate-600">
            New here?{' '}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/reset" className="text-slate-500 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Client form**

`src/app/(auth)/login/LoginForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (!result || result.error) {
      setError('Email or password is incorrect.');
      return;
    }
    // Route to returnTo if safe (same-origin path), otherwise to /dashboard.
    const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//');
    router.replace(safe ? returnTo! : '/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email" name="email" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password" name="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1"
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Make sure NextAuth's SessionProvider wraps client components**

Add a Providers boundary so `signIn`/`useSession` work.

`src/app/Providers.tsx`:
```tsx
'use client';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Wrap in root layout — modify `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Providers } from './Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ItsNotTechy Careers',
  description: 'Join the ItsNotTechy team.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Visit http://localhost:3000/login. Form should render with email + password fields. Submitting an unknown email should show the error alert. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/login/ src/app/Providers.tsx src/app/layout.tsx
git commit -m "feat(auth-ui): add login page with NextAuth credentials flow"
```

---

## Task 30: Register page

**Files:**
- Create: `src/app/(auth)/register/page.tsx`, `src/app/(auth)/register/RegisterForm.tsx`

Calls `registerCandidateAction` via `useFormState`. On success, signs the user in automatically and redirects to `/dashboard/candidate`.

- [ ] **Step 1: Server page**

`src/app/(auth)/register/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Create account · ItsNotTechy Careers' };

export default function RegisterPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Create your candidate account</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Already have one?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
          <div className="mt-4">
            <RegisterForm />
          </div>
        </Card>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Client form**

`src/app/(auth)/register/RegisterForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { registerCandidateAction } from '../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function RegisterForm() {
  const [state, formAction] = useFormState(registerCandidateAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    // Sign the user in with the credentials we just collected.
    // The form values are still in the DOM; pull them and sign in.
    const form = document.querySelector<HTMLFormElement>('form#register-form');
    if (!form) return;
    const fd = new FormData(form);
    void signIn('credentials', {
      email: String(fd.get('email')),
      password: String(fd.get('password')),
      redirect: false,
    }).then((res) => {
      if (res && !res.error) {
        router.replace('/dashboard/candidate');
        router.refresh();
      }
    });
  }, [state, router]);

  return (
    <form id="register-form" action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required className="mt-1"
               invalid={!!state.fieldErrors?.name} />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1"
               invalid={!!state.fieldErrors?.email} />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required className="mt-1"
               invalid={!!state.fieldErrors?.password} />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">At least 10 characters, with upper, lower, and a number.</p>
      </div>
      <Button type="submit" className="w-full">Create account</Button>
    </form>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Visit http://localhost:3000/register. Register with a unique email + valid password. You should be redirected to `/dashboard/candidate` (which shows the dashboard shell once Task 33 is done — until then it'll 404 or render an empty placeholder; that's OK for this task).

Check Prisma Studio: `User` row created with hashed password, `CandidateProfile` linked, `EmailLog` row for welcome email.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/register/
git commit -m "feat(auth-ui): add candidate registration page"
```

---

## Task 31: Invite acceptance + password reset pages

**Files:**
- Create: `src/app/(auth)/invite/[token]/page.tsx`, `src/app/(auth)/invite/[token]/AcceptForm.tsx`
- Create: `src/app/(auth)/reset/page.tsx`, `src/app/(auth)/reset/RequestForm.tsx`
- Create: `src/app/(auth)/reset/[token]/page.tsx`, `src/app/(auth)/reset/[token]/ConfirmForm.tsx`

Three remaining auth UI flows. Same pattern as register: server page wrapping a client form that calls a server action via `useFormState`.

- [ ] **Step 1: Invite acceptance**

`src/app/(auth)/invite/[token]/page.tsx`:
```tsx
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { AcceptForm } from './AcceptForm';

export const metadata = { title: 'Accept your invite · ItsNotTechy Careers' };

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Set your password</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Welcome to ItsNotTechy Careers. Choose a password to activate your account.
          </p>
          <div className="mt-4">
            <AcceptForm token={params.token} />
          </div>
        </Card>
      </main>
    </>
  );
}
```

`src/app/(auth)/invite/[token]/AcceptForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { acceptInviteAction } from '../../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(acceptInviteAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.replace('/login?accepted=1');
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required
               className="mt-1" invalid={!!state.fieldErrors?.password} />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">At least 10 characters, with upper, lower, and a number.</p>
      </div>
      <Button type="submit" className="w-full">Activate account</Button>
    </form>
  );
}
```

- [ ] **Step 2: Reset request**

`src/app/(auth)/reset/page.tsx`:
```tsx
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { RequestForm } from './RequestForm';

export const metadata = { title: 'Reset password · ItsNotTechy Careers' };

export default function ResetRequestPage() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Reset your password</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Enter the email on your account and we'll send a reset link.
          </p>
          <div className="mt-4">
            <RequestForm />
          </div>
          <p className="mt-4 text-sm text-slate-600">
            <Link href="/login" className="hover:underline">Back to sign in</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
```

`src/app/(auth)/reset/RequestForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { requestResetAction } from '../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function RequestForm() {
  const [state, formAction] = useFormState(requestResetAction, initial);

  if (state.ok) {
    return (
      <Alert tone="success">
        If an account exists with that email, a reset link is on the way. Check your inbox.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required
               className="mt-1" invalid={!!state.fieldErrors?.email} />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
  );
}
```

- [ ] **Step 3: Reset confirm**

`src/app/(auth)/reset/[token]/page.tsx`:
```tsx
import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { ConfirmForm } from './ConfirmForm';

export const metadata = { title: 'Choose a new password · ItsNotTechy Careers' };

export default function ResetConfirmPage({ params }: { params: { token: string } }) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Choose a new password</CardTitle>
          <div className="mt-4">
            <ConfirmForm token={params.token} />
          </div>
        </Card>
      </main>
    </>
  );
}
```

`src/app/(auth)/reset/[token]/ConfirmForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { resetPasswordAction } from '../../actions';

const initial: { error?: string; fieldErrors?: Record<string, string[]>; ok?: true } = {};

export function ConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(resetPasswordAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.replace('/login?reset=1');
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required
               className="mt-1" invalid={!!state.fieldErrors?.password} />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>
      <Button type="submit" className="w-full">Update password</Button>
    </form>
  );
}
```

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. Hit each route renders without error:
- `/invite/anything` — should render form (will fail on submit since the token is fake — that's expected, just verifying render)
- `/reset` — should render request form
- `/reset/anything` — should render confirm form

Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/invite/ src/app/\(auth\)/reset/
git commit -m "feat(auth-ui): add invite acceptance and password reset pages"
```

---

## Task 32: Dashboard layout with role-aware sidebar

**Files:**
- Create: `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/components/DashboardShell.tsx`, `src/components/SignOutButton.tsx`

Shared chrome: header with brand + user menu, left sidebar with links per role, main content area. `/dashboard` itself is a redirect (handled by middleware to the per-role dashboard).

- [ ] **Step 1: SignOutButton**

`src/components/SignOutButton.tsx`:
```tsx
'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 2: DashboardShell**

`src/components/DashboardShell.tsx`:
```tsx
import Link from 'next/link';
import type { Role } from '@prisma/client';
import { SignOutButton } from './SignOutButton';

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { href: '/dashboard/admin', label: 'Overview' },
    { href: '/dashboard/admin/users', label: 'Users' },
    { href: '/dashboard/admin/audit', label: 'Audit log' },
    { href: '/dashboard/hr', label: 'HR view' },
  ],
  HR_MANAGER: [
    { href: '/dashboard/hr', label: 'Overview' },
    { href: '/dashboard/hr/jobs', label: 'Job postings' },
    { href: '/dashboard/hr/applicants', label: 'Applicants' },
    { href: '/dashboard/hr/referrals', label: 'Referrals' },
    { href: '/dashboard/hr/promotions', label: 'Promotions' },
    { href: '/dashboard/hr/invite', label: 'Invite staff' },
  ],
  MANAGER: [
    { href: '/dashboard/manager', label: 'Overview' },
    { href: '/dashboard/manager/promotions', label: 'Promotion inbox' },
    { href: '/dashboard/employee', label: 'My referrals' },
  ],
  EMPLOYEE: [
    { href: '/dashboard/employee', label: 'Overview' },
    { href: '/dashboard/employee/refer', label: 'Refer a candidate' },
    { href: '/dashboard/employee/referrals', label: 'My referrals' },
    { href: '/dashboard/employee/promotions', label: 'Promotion requests' },
  ],
  CANDIDATE: [
    { href: '/dashboard/candidate', label: 'My applications' },
    { href: '/dashboard/candidate/profile', label: 'Profile' },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_MANAGER:  'HR Manager',
  MANAGER:     'Manager',
  EMPLOYEE:    'Employee',
  CANDIDATE:   'Candidate',
};

export function DashboardShell({
  children, userName, role,
}: { children: React.ReactNode; userName: string; role: Role }) {
  const nav = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-bold text-brand-700">ItsNotTechy Careers</Link>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[role]}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="w-56 shrink-0">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200/60"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard layout (RSC)**

`src/app/dashboard/layout.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { DashboardShell } from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <DashboardShell userName={user.name} role={user.role}>{children}</DashboardShell>;
}
```

- [ ] **Step 4: `/dashboard` root redirect**

`src/app/dashboard/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/rbac';

export default async function DashboardIndex() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect(dashboardPathForRole(user.role));
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/page.tsx src/components/DashboardShell.tsx src/components/SignOutButton.tsx
git commit -m "feat(ui): add dashboard layout with role-aware sidebar"
```

---

## Task 33: Five dashboard shell pages (one per role)

**Files:**
- Create: `src/app/dashboard/candidate/page.tsx`, `src/app/dashboard/employee/page.tsx`, `src/app/dashboard/manager/page.tsx`, `src/app/dashboard/hr/page.tsx`, `src/app/dashboard/admin/page.tsx`

Each is a minimal welcome page with a "coming in Phase N" placeholder list. Each enforces its role via `requireAnyRole`.

- [ ] **Step 1: Candidate dashboard**

`src/app/dashboard/candidate/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function CandidateDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'CANDIDATE']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <Card>
        <CardTitle>My applications</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Your applications will appear here once you apply to a role.
          The application flow lands in Phase 2.
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Employee dashboard**

`src/app/dashboard/employee/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function EmployeeDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Refer a candidate</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Available in Phase 4.</p>
        </Card>
        <Card>
          <CardTitle>Request a promotion</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Available in Phase 6.</p>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manager dashboard**

`src/app/dashboard/manager/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function ManagerDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <Card>
        <CardTitle>Promotion inbox</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Promotion requests from your direct reports will appear here. Lands in Phase 6.
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: HR dashboard**

`src/app/dashboard/hr/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function HRDashboard() {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardTitle>Job postings</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 2.</p></Card>
        <Card><CardTitle>Applicants</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 3.</p></Card>
        <Card><CardTitle>Referrals</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 4.</p></Card>
        <Card><CardTitle>Interviews</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 5.</p></Card>
        <Card><CardTitle>Promotions</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 6.</p></Card>
        <Card><CardTitle>Invite staff</CardTitle><p className="mt-2 text-sm text-slate-600">Phase 1C placeholder (real form in Phase 1C task 34 or Phase 7).</p></Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Admin dashboard**

`src/app/dashboard/admin/page.tsx`:
```tsx
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { Card, CardTitle } from '@/components/ui/Card';

export default async function AdminDashboard() {
  const user = requireRole(await getSessionUser(), 'SUPER_ADMIN');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>User management</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Full UI in Phase 7.</p>
        </Card>
        <Card>
          <CardTitle>Audit log</CardTitle>
          <p className="mt-2 text-sm text-slate-600">Full viewer in Phase 7. Entries are being recorded now.</p>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual smoke test of role gating**

Run: `npm run dev`. Register a candidate. Try visiting `/dashboard/hr` while logged in as that candidate. Expected: middleware redirects to `/403`. Visiting `/dashboard/candidate` should render.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(ui): add five role-specific dashboard shell pages"
```

---

## Task 34: File storage library

**Files:**
- Create: `src/lib/storage.ts`, `src/lib/storage.test.ts`

Pure helpers — `saveUploadedFile`, `resolveStoredFilePath`, `MIME_BY_PURPOSE`, `MAX_SIZE`. No HTTP concerns.

- [ ] **Step 1: Write failing tests**

`src/lib/storage.test.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import {
  saveUploadedFile,
  resolveStoredFilePath,
  MAX_SIZE,
  MIME_BY_PURPOSE,
} from './storage';

const TEST_ROOT = path.resolve(process.cwd(), 'uploads-test');

beforeEach(() => {
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('saveUploadedFile', () => {
  it('writes the file under <root>/<purpose>/<entityId>/<random>-<original>', async () => {
    const buf = Buffer.from('hello pdf');
    const r = await saveUploadedFile({
      buffer: buf,
      originalFilename: 'resume.pdf',
      mimeType: 'application/pdf',
      purpose: 'resume',
      entityId: 'job-1',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.relativePath.startsWith('resume/job-1/')).toBe(true);
    expect(r.relativePath.endsWith('-resume.pdf')).toBe(true);
    const absolute = path.resolve(TEST_ROOT, r.relativePath);
    expect(fs.readFileSync(absolute).toString()).toBe('hello pdf');
  });

  it('rejects oversize files', async () => {
    const buf = Buffer.alloc(MAX_SIZE + 1);
    const r = await saveUploadedFile({
      buffer: buf,
      originalFilename: 'big.pdf',
      mimeType: 'application/pdf',
      purpose: 'resume',
      entityId: 'x',
    });
    expect(r).toEqual({ ok: false, reason: 'TOO_LARGE' });
  });

  it('rejects disallowed mime types', async () => {
    const r = await saveUploadedFile({
      buffer: Buffer.from('x'),
      originalFilename: 'evil.exe',
      mimeType: 'application/x-msdownload',
      purpose: 'resume',
      entityId: 'x',
    });
    expect(r).toEqual({ ok: false, reason: 'MIME_NOT_ALLOWED' });
  });

  it('sanitizes weird original filenames', async () => {
    const r = await saveUploadedFile({
      buffer: Buffer.from('x'),
      originalFilename: '../../etc/passwd',
      mimeType: 'application/pdf',
      purpose: 'resume',
      entityId: 'x',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.relativePath).not.toContain('..');
    expect(r.relativePath).not.toMatch(/[/\\]passwd$/);
  });
});

describe('resolveStoredFilePath', () => {
  it('returns absolute path inside root', () => {
    const p = resolveStoredFilePath('resume/job-1/abc-resume.pdf');
    expect(p).not.toBeNull();
    expect(p!.startsWith(TEST_ROOT)).toBe(true);
  });

  it('refuses paths that try to escape the root', () => {
    expect(resolveStoredFilePath('../../etc/passwd')).toBeNull();
    expect(resolveStoredFilePath('/abs/path')).toBeNull();
  });
});

describe('MIME_BY_PURPOSE', () => {
  it('whitelists resume types', () => {
    expect(MIME_BY_PURPOSE.resume).toContain('application/pdf');
    expect(MIME_BY_PURPOSE.resume).toContain('application/msword');
  });
  it('whitelists supporting-doc types including images', () => {
    expect(MIME_BY_PURPOSE['supporting-doc']).toContain('image/png');
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- src/lib/storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/storage.ts`:
```ts
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export type Purpose = 'resume' | 'supporting-doc';

export const MIME_BY_PURPOSE: Record<Purpose, readonly string[]> = {
  resume: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'supporting-doc': [
    'application/pdf',
    'image/png',
    'image/jpeg',
  ],
};

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './uploads');
}

function sanitizeFilename(original: string): string {
  const base = path.basename(original).replace(/[^A-Za-z0-9._-]/g, '_');
  // Strip leading dots so we never write hidden files.
  return base.replace(/^\.+/, '') || 'file';
}

export type SaveResult =
  | { ok: true; relativePath: string }
  | { ok: false; reason: 'TOO_LARGE' | 'MIME_NOT_ALLOWED' };

export async function saveUploadedFile(input: {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  purpose: Purpose;
  entityId: string;
}): Promise<SaveResult> {
  if (input.buffer.byteLength > MAX_SIZE) return { ok: false, reason: 'TOO_LARGE' };
  if (!MIME_BY_PURPOSE[input.purpose].includes(input.mimeType)) {
    return { ok: false, reason: 'MIME_NOT_ALLOWED' };
  }

  const safeEntity = input.entityId.replace(/[^A-Za-z0-9_-]/g, '');
  const safeName = sanitizeFilename(input.originalFilename);
  const random = crypto.randomBytes(8).toString('hex');
  const relativePath = path.posix.join(input.purpose, safeEntity, `${random}-${safeName}`);
  const absolute = path.resolve(storageRoot(), relativePath);

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);
  return { ok: true, relativePath };
}

export function resolveStoredFilePath(relativePath: string): string | null {
  if (relativePath.startsWith('/') || relativePath.includes('..')) return null;
  const root = storageRoot();
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) return null;
  return absolute;
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- src/lib/storage.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat(storage): add saveUploadedFile + resolveStoredFilePath helpers"
```

---

## Task 35: Upload API route

**Files:**
- Create: `src/app/api/upload/route.ts`

`POST /api/upload` — multipart form: `file`, `purpose` (`resume` | `supporting-doc`), `entityId`. Requires an authenticated session of any role except CANDIDATE for `supporting-doc`; CANDIDATE may upload `resume`s.

For Phase 1 the entity-level ownership check is minimal: presence of a session is the gate. Phase 2 and beyond will add per-entity ownership when the entities exist.

- [ ] **Step 1: Implement**

`src/app/api/upload/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { saveUploadedFile, MIME_BY_PURPOSE, type Purpose } from '@/lib/storage';

const purposeSchema = z.enum(['resume', 'supporting-doc']);

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const purposeRaw = form.get('purpose');
  const entityIdRaw = form.get('entityId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 });
  }
  const purposeParse = purposeSchema.safeParse(purposeRaw);
  if (!purposeParse.success || typeof entityIdRaw !== 'string' || !entityIdRaw) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  const purpose: Purpose = purposeParse.data;

  // Role gating for purpose. CANDIDATE may only upload resumes.
  if (purpose === 'supporting-doc' && user.role === 'CANDIDATE') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  if (!MIME_BY_PURPOSE[purpose].includes(file.type)) {
    return NextResponse.json({ error: 'MIME_NOT_ALLOWED' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await saveUploadedFile({
    buffer,
    originalFilename: file.name,
    mimeType: file.type,
    purpose,
    entityId: entityIdRaw,
  });

  if (!result.ok) {
    const status = result.reason === 'TOO_LARGE' ? 413 : 415;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true, relativePath: result.relativePath });
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server, log in as a candidate. From browser devtools console:
```js
const fd = new FormData();
const blob = new Blob(['test'], { type: 'application/pdf' });
fd.append('file', new File([blob], 'r.pdf', { type: 'application/pdf' }));
fd.append('purpose', 'resume');
fd.append('entityId', 'temp');
await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
```
Expected: returns `{ ok: true, relativePath: 'resume/temp/<hex>-r.pdf' }`. Verify `./uploads/resume/temp/...` exists on disk.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/
git commit -m "feat(api): add /api/upload route with role gating and validation"
```

---

## Task 36: File-serving API route

**Files:**
- Create: `src/app/api/files/[...path]/route.ts`

`GET /api/files/<purpose>/<entityId>/<filename>` — auth required. For Phase 1 we only check session presence; ownership checks land in later phases once Application/PromotionRequest UIs exist.

- [ ] **Step 1: Implement**

`src/app/api/files/[...path]/route.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveStoredFilePath } from '@/lib/storage';

const EXT_TO_MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const relative = params.path.join('/');
  const absolute = resolveStoredFilePath(relative);
  if (!absolute) return NextResponse.json({ error: 'BAD_PATH' }, { status: 400 });
  if (!fs.existsSync(absolute)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const ext = path.extname(absolute).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

  const data = await fs.promises.readFile(absolute);
  return new Response(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${path.basename(absolute)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

- [ ] **Step 2: Manual smoke**

While dev server is running and logged in, visit `http://localhost:3000/api/files/resume/temp/<hex>-r.pdf` (use the path from Task 35). Browser displays the file (or downloads it). Logging out and re-requesting returns 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/files/
git commit -m "feat(api): add auth-gated /api/files/[...path] streamer"
```

---

## Task 37: Seed script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add seed script + prisma config)

Creates: 1 Super Admin (from env), 1 HR Manager, 1 Manager, 2 Employees (one reporting to Manager), 2 Candidates.

- [ ] **Step 1: Add `prisma.seed` config + npm script to `package.json`**

Edit `package.json`:
- Add to `"scripts"`:
  ```json
  "seed": "tsx prisma/seed.ts",
  "prisma:seed": "tsx prisma/seed.ts"
  ```
- Add at top level (sibling of `"scripts"`):
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```

- [ ] **Step 2: Write the seed**

`prisma/seed.ts`:
```ts
import { config } from 'dotenv';
config();
import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(p: string) {
  return bcrypt.hash(p, 12);
}

async function ensureUser(args: {
  email: string;
  name: string;
  role: Role;
  password: string;
  employee?: {
    employeeCode: string;
    department: string;
    title: string;
    managerEmail?: string;
    hireDate: Date;
  };
  candidate?: boolean;
}) {
  const email = args.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  (skip) ${email} already exists`);
    return existing;
  }

  let managerId: string | null = null;
  if (args.employee?.managerEmail) {
    const m = await prisma.user.findUnique({
      where: { email: args.employee.managerEmail.toLowerCase() },
      include: { employee: true },
    });
    managerId = m?.employee?.id ?? null;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: args.name,
      role: args.role,
      passwordHash: await hash(args.password),
      employee: args.employee
        ? {
            create: {
              employeeCode: args.employee.employeeCode,
              department: args.employee.department,
              title: args.employee.title,
              hireDate: args.employee.hireDate,
              managerId,
            },
          }
        : undefined,
      candidateProfile: args.candidate ? { create: {} } : undefined,
    },
  });
  console.log(`  + ${args.role.padEnd(12)} ${email}`);
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPass  = process.env.SEED_ADMIN_PASSWORD;
  const adminName  = process.env.SEED_ADMIN_NAME ?? 'Site Administrator';
  if (!adminEmail || !adminPass) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env');
  }

  console.log('Seeding ItsNotTechy Careers…\n');

  // 1. Super Admin
  await ensureUser({
    email: adminEmail,
    name: adminName,
    role: 'SUPER_ADMIN',
    password: adminPass,
  });

  // 2. HR Manager
  await ensureUser({
    email: 'hr@itsnottechy.com',
    name: 'Pat Hernandez',
    role: 'HR_MANAGER',
    password: 'HRpassword!1',
    employee: {
      employeeCode: 'HR001',
      department: 'People',
      title: 'HR Manager',
      hireDate: new Date('2024-01-15'),
    },
  });

  // 3. Manager
  await ensureUser({
    email: 'manager@itsnottechy.com',
    name: 'Jordan Kim',
    role: 'MANAGER',
    password: 'Mgrpassword!1',
    employee: {
      employeeCode: 'ENG001',
      department: 'Engineering',
      title: 'Engineering Manager',
      hireDate: new Date('2024-02-01'),
    },
  });

  // 4. Employee reporting to manager
  await ensureUser({
    email: 'sam@itsnottechy.com',
    name: 'Sam Patel',
    role: 'EMPLOYEE',
    password: 'Emppassword!1',
    employee: {
      employeeCode: 'ENG002',
      department: 'Engineering',
      title: 'Software Engineer',
      managerEmail: 'manager@itsnottechy.com',
      hireDate: new Date('2024-06-12'),
    },
  });

  // 5. Employee with no manager (HR will assign later)
  await ensureUser({
    email: 'taylor@itsnottechy.com',
    name: 'Taylor Brooks',
    role: 'EMPLOYEE',
    password: 'Emppassword!1',
    employee: {
      employeeCode: 'OPS001',
      department: 'Operations',
      title: 'Operations Lead',
      hireDate: new Date('2024-09-04'),
    },
  });

  // 6 & 7. Sample candidates
  await ensureUser({
    email: 'alice.candidate@example.com',
    name: 'Alice Rivera',
    role: 'CANDIDATE',
    password: 'CandPass!12',
    candidate: true,
  });
  await ensureUser({
    email: 'ben.candidate@example.com',
    name: 'Ben Okafor',
    role: 'CANDIDATE',
    password: 'CandPass!12',
    candidate: true,
  });

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Run the seed**

Run: `npm run seed`
Expected: prints each user with `+ ROLE email`. Open Prisma Studio (`npx prisma studio`) — 7 users present, 4 Employee rows, 2 CandidateProfile rows. The Engineering Manager has Sam as a direct report.

- [ ] **Step 4: Confirm login works**

Run `npm run dev`, log in as `hr@itsnottechy.com` / `HRpassword!1`. Expected: redirected to `/dashboard/hr`. Sign out. Log in as `alice.candidate@example.com` / `CandPass!12`. Expected: `/dashboard/candidate`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat(seed): create Super Admin + sample HR, Manager, Employees, Candidates"
```

---

## Task 38: PM2 ecosystem config

**Files:**
- Create: `ecosystem.config.cjs`

PM2 process definition used by the VPS deploy guide.

- [ ] **Step 1: Create config**

`ecosystem.config.cjs`:
```js
module.exports = {
  apps: [
    {
      name: 'itsnottechy-careers',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/opt/itsnottechy-careers',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      autorestart: true,
      time: true,
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add ecosystem.config.cjs
git commit -m "chore(deploy): add PM2 ecosystem config"
```

---

## Task 39: README with VPS deploy guide

**Files:**
- Create: `README.md`

End-to-end runbook covering local dev + production deploy on an Ubuntu VPS.

- [ ] **Step 1: Write README**

`README.md`:
````markdown
# ItsNotTechy Careers

A hiring management portal — job postings, applicant tracking, referrals,
interview scheduling, and promotion workflows. Built on Next.js 14, Prisma,
PostgreSQL, and NextAuth.

This README covers **Phase 1**: scaffold, authentication, dashboards, file
upload, seed, and deploy. Job posting, ATS, referrals, interviews, and
promotions are added in later phases per the plans in `docs/superpowers/plans/`.

---

## Local development

### Prerequisites
- Node.js 20 LTS (`node -v`)
- npm 10+
- Docker Desktop (for Postgres)

### Setup

```bash
git clone <repo-url> careeritsnottechy
cd careeritsnottechy
npm install
cp .env.example .env
# Edit .env:
#   - NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   - SMTP_PASS=<your Hostinger mailbox password>
docker compose up -d postgres
npx prisma migrate dev
npm run seed
npm run dev
```

Open http://localhost:3000.

### Seed accounts

| Role          | Email                                | Password        |
|---------------|--------------------------------------|-----------------|
| Super Admin   | from `.env` `SEED_ADMIN_EMAIL`       | from `.env`     |
| HR Manager    | hr@itsnottechy.com                   | HRpassword!1    |
| Manager       | manager@itsnottechy.com              | Mgrpassword!1   |
| Employee      | sam@itsnottechy.com                  | Emppassword!1   |
| Employee      | taylor@itsnottechy.com               | Emppassword!1   |
| Candidate     | alice.candidate@example.com          | CandPass!12     |
| Candidate     | ben.candidate@example.com            | CandPass!12     |

Change all seed passwords before deploying to anything externally reachable.

### Common commands

| Command              | What it does                                   |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start Next.js dev server on port 3000          |
| `npm run build`      | Production build                               |
| `npm start`          | Run the production build                       |
| `npm test`           | Run the Vitest suite                           |
| `npm run lint`       | ESLint                                         |
| `npm run seed`       | (Re)seed the database — idempotent             |
| `npx prisma studio`  | Open Prisma Studio at http://localhost:5555    |
| `npx prisma migrate dev --name <change>` | Author a new migration         |

### Email in dev

By default, `.env` has `EMAIL_TEST_MODE=true` — emails are logged to the
`EmailLog` table and printed to the console, never sent. Set
`EMAIL_TEST_MODE=false` and provide real `SMTP_*` credentials to send for
real.

---

## Production deploy (Ubuntu 22.04 VPS)

The target domain is `career.itsnottechy.com`. Adjust as needed.

### 1. Server prerequisites

```bash
# As a sudo user on the VPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx ufw

# Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# PM2
sudo npm i -g pm2

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. Create the database and DB user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER careers WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE careers OWNER careers;
SQL
```

### 3. Clone and configure

```bash
sudo mkdir -p /opt/itsnottechy-careers
sudo chown $USER:$USER /opt/itsnottechy-careers
cd /opt/itsnottechy-careers
git clone <repo-url> .
npm ci
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL=postgresql://careers:CHANGE_ME_STRONG_PASSWORD@localhost:5432/careers?schema=public`
- `NEXTAUTH_URL=https://career.itsnottechy.com`
- `NEXTAUTH_SECRET=` (run `openssl rand -base64 32`)
- `SMTP_PASS=` (real Hostinger mailbox password)
- `EMAIL_TEST_MODE=false`
- `STORAGE_ROOT=/var/itsnottechy/uploads`
- `APP_URL=https://career.itsnottechy.com`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` — set the first admin you want to create.

Lock down `.env`:
```bash
chmod 600 .env
```

### 4. Migrate, seed, build

```bash
sudo mkdir -p /var/itsnottechy/uploads
sudo chown $USER:$USER /var/itsnottechy/uploads

npx prisma migrate deploy
npm run seed       # creates the Super Admin and sample staff/candidates
npm run build
```

### 5. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd      # follow the printed instruction once
```

`pm2 status` should show `itsnottechy-careers` online.

### 6. Nginx reverse proxy

Create `/etc/nginx/sites-available/career.itsnottechy.com`:

```nginx
server {
    listen 80;
    server_name career.itsnottechy.com;

    client_max_body_size 6M;   # leaves headroom over the app's 5MB upload limit

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/career.itsnottechy.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Confirm `http://career.itsnottechy.com` shows the landing page.

### 7. TLS with Certbot

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d career.itsnottechy.com
```

Follow prompts. Renewal is scheduled automatically by the snap.
After issuance, visiting `https://career.itsnottechy.com` should work and HTTP
should redirect to HTTPS.

### 8. Deploying updates

```bash
cd /opt/itsnottechy-careers
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart itsnottechy-careers
```

### Backups (manual cron suggestions — not installed by deploy)

Add via `crontab -e`:

```cron
# Daily Postgres dump at 03:15
15 3 * * * pg_dump -U careers careers | gzip > /var/backups/postgres/careers-$(date +\%F).sql.gz

# Daily uploads tarball at 03:30
30 3 * * * tar -czf /var/backups/uploads/uploads-$(date +\%F).tar.gz -C /var/itsnottechy uploads

# Rotate (keep 30 days)
0 4 * * * find /var/backups -type f -mtime +30 -delete
```

---

## Project layout

```
src/
  app/                # Next.js App Router
    (auth)/           # login, register, invite, reset
    api/              # auth, upload, files
    dashboard/        # role-based dashboards
  components/         # UI components
    ui/               # Button, Input, Card, etc.
  emails/             # HTML templates + base layout
  lib/                # business logic, services, helpers
    auth/             # NextAuth + session helpers
    email/            # sendEmail, transport, templates
    services/         # userService etc.
    validation/       # Zod schemas
  types/              # shared TS types
  middleware.ts       # route protection
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  superpowers/
    specs/            # design docs
    plans/            # phase-by-phase implementation plans
```

---

## What's next

Phase 1 (this plan set, 1A + 1B + 1C) gets you a deployable foundation with
working auth. Subsequent phases — Jobs+Apply, ATS Pipeline, Referrals,
Interviews, Promotions, Admin polish — are tracked in
`docs/superpowers/specs/2026-05-17-itsnottechy-careers-design.md` and have
their own implementation plans written before each phase starts.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with local dev and full VPS deployment guide"
```

---

## Task 40: Phase 1 acceptance checklist

The whole-phase smoke test. Run through this end-to-end. Any failure here means Phase 1 is not done.

- [ ] **Full test suite green**

```bash
npm test
```
Expected: all tests pass (~70+ tests across all three plans).

- [ ] **Type-check clean**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Lint clean**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Build succeeds**

```bash
npm run build
```
Expected: build prints route table including:
- `/` (static)
- `/jobs` (TBD in Phase 2 — should not exist yet)
- `/login`, `/register`, `/invite/[token]`, `/reset`, `/reset/[token]`
- `/dashboard`, `/dashboard/{admin,hr,manager,employee,candidate}`
- `/403`, `/api/auth/[...nextauth]`, `/api/upload`, `/api/files/[...path]`

- [ ] **DB migrated and seeded**

```bash
docker compose ps   # postgres should be running
npm run seed
```
Open `npx prisma studio`. Verify 7 users (1 admin, 1 HR, 1 manager, 2 employees, 2 candidates) and the manager-report relationship.

- [ ] **Manual happy paths**

Run `npm run dev` and verify each:

1. **Landing** — `/` renders, links to `/jobs` (will 404 for now), `/register`, `/login`.
2. **Candidate self-register** — `/register` with new email → redirects to `/dashboard/candidate`. EmailLog has welcome row.
3. **Candidate login/logout** — `/login` with seeded candidate → `/dashboard/candidate`. Sign out → `/`.
4. **HR login** — `/login` with `hr@itsnottechy.com` → `/dashboard/hr`. Sidebar shows HR-only links.
5. **Cross-role 403** — Logged in as candidate, manually visit `/dashboard/hr` → redirected to `/403`.
6. **Unauth redirect** — Logged out, visit `/dashboard/hr` → redirected to `/login?returnTo=%2Fdashboard%2Fhr`.
7. **Password reset** — `/reset` with any seed account email → see "if an account exists…" message. EmailLog row recorded (or sent if `EMAIL_TEST_MODE=false`).
8. **Invite acceptance (manual)** — In Prisma Studio, create a `User{role:EMPLOYEE, passwordHash:null}` then an `InviteToken` for them with a future `expiresAt`. Visit `/invite/<token>`, set password, log in. Confirms the flow without needing a Phase 7 invite UI.
9. **File upload** — Logged in as a candidate, use the devtools fetch snippet from Task 35 → `200 { ok: true, ... }`. Visit the returned path under `/api/files/...` → file streams back.

- [ ] **No secrets in git**

```bash
git grep -i 'ons3ctiv3\|SMTP_PASS=' -- ':!.env.example'
```
Expected: no output. The Hostinger password lives only in your local `.env`, never in source.

- [ ] **Commit final tag**

If everything above passes:
```bash
git tag phase-1-complete
git log --oneline | head -20
```

Phase 1 is done. Plans for Phase 2 (Jobs + Apply) will be written before Phase 2 begins.

---

## Self-review notes (informational)

- The dashboard layout calls `getSessionUser()` in an RSC; the middleware *also* enforces the prefix check. Belt and braces — middleware runs in the Edge runtime and protects against pre-render leakage, the RSC check protects against direct rendering paths.
- File upload's per-entity ownership is intentionally permissive in Phase 1 (just "are you signed in"). Phase 2 wires the resume upload into a candidate's own application; Phase 6 does the same for promotion supporting docs. Each phase tightens the file-serving auth alongside the entity it introduces.
- Nginx `client_max_body_size 6M` leaves a 1MB cushion over the app's 5MB limit so the rejection comes from the app (cleaner error) rather than Nginx.
- The README's seed-password warning is intentional. The seed exists to bootstrap; production deploys must rotate.
- The full Phase 1 acceptance checklist (Task 40) doubles as a smoke test the executor can run on any future change to confirm no regression in the foundation.
