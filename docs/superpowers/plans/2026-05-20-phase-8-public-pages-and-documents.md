# Phase 8 — Public Pages & Required Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four public content pages plus an enriched Home page, and let HR demand named documents from applicants — both at job creation (collected during apply) and later (requested mid-pipeline).

**Architecture:** Part A is static React Server Components reusing the existing brand pattern — no database changes. Part B adds one Prisma model (`ApplicationDocument`) and a JSON field on `Job`, a `documentService`, a Zod schema, an email template, and four UI touchpoints. Each part ships independently; Part A first.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Zod, NextAuth, Tailwind, Vitest.

**Conventions for every task:**
- Node/npm come from nvm — prefix shell commands with `PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"` if `npm` is not found.
- `npm test` runs the full Vitest suite; `npx vitest run <path>` runs one file.
- Tests touching the DB target the `careers_test` database (see `vitest.config.ts` / `.env.test`) and call `resetDb()` in `beforeEach`.
- Commit after every task with the message shown in its final step.
- Spec: `docs/superpowers/specs/2026-05-20-phase-8-public-pages-and-documents-design.md`.

---

# Part A — Public content pages

## Task 1: Shared `PublicFooter` component

**Files:**
- Create: `src/components/PublicFooter.tsx`

- [ ] **Step 1: Create the component**

`src/components/PublicFooter.tsx`:
```tsx
import Link from 'next/link';

const LINKS: { href: string; label: string }[] = [
  { href: '/jobs', label: 'Open roles' },
  { href: '/culture', label: 'Culture & Belonging' },
  { href: '/benefits', label: 'Benefits & Perks' },
  { href: '/resources', label: 'Candidate Resources' },
  { href: '/life', label: 'Life & Offices' },
  { href: '/login', label: 'Sign in' },
];

export function PublicFooter() {
  return (
    <footer className="bg-ink-600">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light-cropped.png" alt="It's Not Techy" className="h-9 w-auto" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-slate-300 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-sm text-slate-400">
          © {new Date().getFullYear()} It&apos;s Not Techy. Digital marketing that speaks human.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (the component is unused so far — this only checks it compiles).

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicFooter.tsx
git commit -m "feat(public): add shared PublicFooter component"
```

---

## Task 2: Add page links to `PublicNav`

**Files:**
- Modify: `src/components/PublicNav.tsx`

- [ ] **Step 1: Replace the `<nav>` block**

In `src/components/PublicNav.tsx`, replace the entire `<nav>...</nav>` element with:
```tsx
        <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
          <Link href="/jobs" className="text-slate-700 hover:text-slate-900">Open roles</Link>
          <Link href="/culture" className="text-slate-700 hover:text-slate-900">Culture</Link>
          <Link href="/benefits" className="text-slate-700 hover:text-slate-900">Benefits</Link>
          <Link href="/resources" className="text-slate-700 hover:text-slate-900">Resources</Link>
          <Link href="/life" className="text-slate-700 hover:text-slate-900">Life</Link>
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
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicNav.tsx
git commit -m "feat(public): link new content pages from PublicNav"
```

---

## Task 3: Culture & Belonging page

**Files:**
- Create: `src/app/culture/page.tsx`

- [ ] **Step 1: Create the page**

`src/app/culture/page.tsx`:
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Culture & Belonging · It’s Not Techy Careers',
  description: 'How the It’s Not Techy team works, what we value, and our commitment to belonging.',
};

const VALUES: { title: string; body: string }[] = [
  { title: 'Senior people, real outcomes', body: 'Senior practitioners work directly on every account. We measure success by pipeline and revenue, not billable hours.' },
  { title: 'Transparency by default', body: 'Clear scopes, honest timelines, and shared dashboards. Clients and teammates always know where things stand.' },
  { title: 'One connected team', body: 'Web, brand, content, and paid specialists work as one system so campaigns compound rather than compete.' },
  { title: 'Curiosity over comfort', body: 'We test, learn, and adopt new tools — including AI workflows — faster than the industry average.' },
];

export default function CulturePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Working here</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Culture &amp; Belonging</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              It&apos;s Not Techy is a global digital marketing agency built on senior craft, candour, and
              genuine care for the people who do the work.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">What we value</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {VALUES.map((v) => (
                <div key={v.title} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-brand-700">{v.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Belonging is the baseline</h2>
            <p className="mt-4 text-lg text-slate-600">
              Our work spans eight offices across the Americas, EMEA, APAC, and Oceania — and our team
              reflects that reach. We hire for craft and character, build accommodations into how we work,
              and expect every person to be heard regardless of role, office, or background. Mentorship,
              clear progression, and pay equity are commitments, not perks.
            </p>
            <div className="mt-8">
              <Link href="/jobs"><Button size="lg">See open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify the build and route**

Run: `npm run build`
Expected: build succeeds and lists `/culture` in the route output.

- [ ] **Step 3: Commit**

```bash
git add src/app/culture/page.tsx
git commit -m "feat(public): add Culture & Belonging page"
```

---

## Task 4: Benefits & Perks page

**Files:**
- Create: `src/app/benefits/page.tsx`

- [ ] **Step 1: Create the page**

`src/app/benefits/page.tsx`:
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Benefits & Perks · It’s Not Techy Careers',
  description: 'Compensation, flexible working, time off, and growth at It’s Not Techy.',
};

const PILLARS: { title: string; body: string }[] = [
  { title: 'Fair, transparent pay', body: 'Benchmarked salary bands reviewed annually, with pay equity across offices for comparable roles.' },
  { title: 'Remote & hybrid by design', body: 'Work from home or from any of our eight offices. Roles are clear about what, if anything, must be onsite.' },
  { title: 'Time off & wellbeing', body: 'Generous paid leave, local public holidays, parental leave, and wellbeing days you are encouraged to take.' },
  { title: 'Learning & growth', body: 'An annual learning budget, conference support, and a clear progression path with senior mentors.' },
];

const PERKS: string[] = [
  'Home-office setup stipend',
  'Annual learning & certification budget',
  'Team offsites and regional meetups',
  'Health coverage appropriate to your region',
  'Latest hardware of your choosing',
  'Paid volunteering days',
];

export default function BenefitsPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Rewards</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Benefits &amp; Perks</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              We invest in the people who do the work — with fair pay, real flexibility, and room to grow.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="grid gap-6 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-brand-700">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">The extras</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {PERKS.map((perk) => (
                <span key={perk} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                  {perk}
                </span>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">See open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds and lists `/benefits`.

- [ ] **Step 3: Commit**

```bash
git add src/app/benefits/page.tsx
git commit -m "feat(public): add Benefits & Perks page"
```

---

## Task 5: Candidate Resources page

**Files:**
- Create: `src/app/resources/page.tsx`

- [ ] **Step 1: Create the page**

`src/app/resources/page.tsx`:
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Candidate Resources · It’s Not Techy Careers',
  description: 'How hiring works at It’s Not Techy, interview tips, and answers to common questions.',
};

const STEPS: { n: string; title: string; body: string }[] = [
  { n: '1', title: 'Apply', body: 'Submit your application and any documents the role asks for. You will get an email confirmation.' },
  { n: '2', title: 'Review', body: 'A hiring manager reviews every application by hand — no black-box screening.' },
  { n: '3', title: 'Interview', body: 'One or two conversations with the team you would work with, focused on real craft.' },
  { n: '4', title: 'Offer', body: 'A clear written offer. We aim to keep the whole process to two to three weeks.' },
];

const TIPS: string[] = [
  'Show outcomes, not just tasks — pipeline, revenue, and growth tell the story.',
  'Bring examples of work you are proud of and can speak to in depth.',
  'Have questions ready; interviews go both ways.',
  'Upload requested documents promptly so your application keeps moving.',
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need an account to apply?', a: 'Yes — create a free candidate account so you can track your application and upload documents.' },
  { q: 'Can I apply to more than one role?', a: 'Absolutely. Each application is reviewed on its own merits.' },
  { q: 'What documents will I need?', a: 'A resume always; some roles also request items such as a portfolio or work-eligibility proof. The apply form lists exactly what is required.' },
  { q: 'How will I hear back?', a: 'By email, and your candidate dashboard always shows your current stage.' },
];

export default function ResourcesPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">For candidates</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Candidate Resources</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Everything you need to apply with confidence — how hiring works, how to prepare, and answers
              to common questions.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">How hiring works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-lg border border-slate-200 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{s.n}</div>
                  <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Interview preparation</h2>
            <ul className="mt-4 space-y-2">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2 text-slate-600">
                  <span aria-hidden className="text-brand-600">&#10003;</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer font-medium text-slate-900">{item.q}</summary>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">Browse open roles</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds and lists `/resources`.

- [ ] **Step 3: Commit**

```bash
git add src/app/resources/page.tsx
git commit -m "feat(public): add Candidate Resources page"
```

---

## Task 6: Life & Offices page

**Files:**
- Create: `src/app/life/page.tsx`

- [ ] **Step 1: Create the page**

`src/app/life/page.tsx`:
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Life & Offices · It’s Not Techy Careers',
  description: 'Where It’s Not Techy works — eight offices across four regions — and what daily life looks like.',
};

const OFFICES: { city: string; role: string }[] = [
  { city: 'Toronto, Canada', role: 'Global HQ' },
  { city: 'New York, USA', role: 'Americas Hub' },
  { city: 'London, United Kingdom', role: 'EMEA Hub' },
  { city: 'Dubai, UAE', role: 'Middle East Hub' },
  { city: 'Mumbai, India', role: 'APAC Delivery Center' },
  { city: 'Singapore', role: 'APAC Hub' },
  { city: 'Sydney, Australia', role: 'Oceania Hub' },
  { city: 'Berlin, Germany', role: 'EU Engineering' },
];

export default function LifePage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Around the world</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Life &amp; Offices</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Eight offices, four regions, one connected team — staffed by local practitioners who know
              their markets.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">Our offices</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {OFFICES.map((o) => (
                <div key={o.city} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{o.city}</h3>
                  <p className="mt-1 text-sm text-brand-700">{o.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">A day in the life</h2>
            <p className="mt-4 text-lg text-slate-600">
              No two days look the same, but the rhythm is consistent: focused mornings on craft, midday
              collaboration across time zones, and afternoons spent shipping work that moves a client&apos;s
              numbers. Teams are small and senior, meetings have a purpose, and async updates keep everyone
              aligned without living in their inbox. Whether you join from home or from one of our offices,
              you work alongside people who care about the outcome.
            </p>
            <div className="mt-10">
              <Link href="/jobs"><Button size="lg">Find your role</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds and lists `/life`.

- [ ] **Step 3: Commit**

```bash
git add src/app/life/page.tsx
git commit -m "feat(public): add Life & Offices page"
```

---

## Task 7: Enrich the Home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add an "Explore" section and use the shared footer**

In `src/app/page.tsx`:

1. Add this import near the top, after the `Button` import:
```tsx
import { PublicFooter } from '@/components/PublicFooter';
```

2. Replace the entire `<footer ...>...</footer>` block (the brand-dark footer at the bottom of `<main>`) with a new "Explore" section followed by the shared footer:
```tsx
        {/* Explore the company */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Explore It&apos;s Not Techy
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Get to know us before you apply
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <ExploreCard href="/culture" title="Culture & Belonging" body="Our values, how we work, and our commitment to belonging." />
              <ExploreCard href="/benefits" title="Benefits & Perks" body="Pay, flexible working, time off, and how we invest in growth." />
              <ExploreCard href="/resources" title="Candidate Resources" body="How hiring works, interview tips, and common questions." />
              <ExploreCard href="/life" title="Life & Offices" body="Eight offices across four regions, and daily life on the team." />
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
```

   Note: this replacement ends `<main>`, renders `<PublicFooter />`, and closes the fragment and function — so delete the old `</main>`, `</>`, and `}` that previously followed the footer.

3. Add this helper function at the end of the file, after the existing `Stat` function:
```tsx
function ExploreCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300"
    >
      <h3 className="font-semibold text-brand-700">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </Link>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(public): enrich Home with company sections and shared footer"
```

---

# Part B — Required documents

## Task 8: Prisma schema — `ApplicationDocument` model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/test/db.ts`

- [ ] **Step 1: Add the enum and model**

In `prisma/schema.prisma`:

1. Add a new enum next to the other enums (e.g. after `enum EmailStatus`):
```prisma
enum DocumentStatus {
  PENDING
  SUBMITTED
}
```

2. Add `requiredDocuments` to the `Job` model, immediately after the `customQuestions` line:
```prisma
  requiredDocuments Json @default("[]")
```

3. Add a `documents` relation to the `Application` model, in its relation block (next to `notes` / `interviews`):
```prisma
  documents  ApplicationDocument[]
```

4. Add a relation to the `User` model, alongside its other relation fields:
```prisma
  documentsRequested ApplicationDocument[] @relation("DocumentsRequested")
```

5. Add the new model after the `ApplicationNote` model:
```prisma
model ApplicationDocument {
  id            String         @id @default(cuid())
  applicationId String
  application   Application    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  label         String
  instructions  String?        @db.Text
  fileUrl       String?
  status        DocumentStatus @default(SUBMITTED)
  requestedById String?
  requestedBy   User?          @relation("DocumentsRequested", fields: [requestedById], references: [id])
  createdAt     DateTime       @default(now())
  submittedAt   DateTime?

  @@index([applicationId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_application_documents`
Expected: a new folder under `prisma/migrations/` is created and applied; `prisma generate` runs automatically. No errors.

- [ ] **Step 3: Add the table to the test-DB reset helper**

In `src/lib/test/db.ts`, add `'ApplicationDocument',` to the `tables` array, on the line immediately **before** `'Application',`:
```ts
    'ApplicationDocument',
    'Application',
```

- [ ] **Step 4: Apply the migration to the test database**

Run: `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`
Expected: "All migrations have been successfully applied." (If `$TEST_DATABASE_URL` is not exported in your shell, read it from `.env.test` and pass it inline.)

- [ ] **Step 5: Run the suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/test/db.ts
git commit -m "feat(documents): add ApplicationDocument model and Job.requiredDocuments"
```

---

## Task 9: `RequiredDocument` type and validation schema

**Files:**
- Create: `src/types/requiredDocuments.ts`
- Modify: `src/lib/validation/jobs.ts`
- Test: `src/lib/validation/jobs.test.ts` (existing file — add cases)

- [ ] **Step 1: Create the type**

`src/types/requiredDocuments.ts`:
```ts
export type RequiredDocument = {
  id: string;
  name: string;
  required: boolean;
  instructions?: string;
};
```

- [ ] **Step 2: Write failing tests**

Append to `src/lib/validation/jobs.test.ts` (keep existing imports; add `requiredDocumentsSchema` to the import from `./jobs` if it imports named exports — otherwise add a new import line `import { requiredDocumentsSchema } from './jobs';`):
```ts
describe('requiredDocumentsSchema', () => {
  it('accepts a valid list', () => {
    const r = requiredDocumentsSchema.safeParse([
      { id: 'd1', name: 'Portfolio', required: true },
      { id: 'd2', name: 'Government ID', required: false, instructions: 'PDF or photo' },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const r = requiredDocumentsSchema.safeParse([{ id: 'd1', name: '', required: true }]);
    expect(r.success).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const r = requiredDocumentsSchema.safeParse([
      { id: 'dup', name: 'A', required: true },
      { id: 'dup', name: 'B', required: false },
    ]);
    expect(r.success).toBe(false);
  });

  it('defaults to an empty array when omitted from a job', () => {
    const parsed = jobInputSchema.safeParse({
      title: 'Engineer', department: 'Engineering', locationType: 'REMOTE',
      type: 'FULL_TIME', description: 'A long enough description here.',
      requirements: 'Some reqs.', currency: 'USD', customQuestions: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.requiredDocuments).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/jobs.test.ts`
Expected: FAIL — `requiredDocumentsSchema` is not exported.

- [ ] **Step 4: Implement the schema**

In `src/lib/validation/jobs.ts`:

1. Add after the `customQuestionsSchema` definition:
```ts
export const requiredDocumentsSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(120),
      required: z.boolean(),
      instructions: z.string().max(2000).optional(),
    }),
  )
  .max(15)
  .default([])
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (const d of arr) {
      if (seen.has(d.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate document id: ${d.id}` });
        return;
      }
      seen.add(d.id);
    }
  });
```

2. Add `requiredDocuments` to the object passed to `z.object({...})` in `jobInputSchema`, on the line after `customQuestions: customQuestionsSchema,`:
```ts
  requiredDocuments: requiredDocumentsSchema,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/jobs.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/requiredDocuments.ts src/lib/validation/jobs.ts src/lib/validation/jobs.test.ts
git commit -m "feat(documents): add requiredDocuments type and validation schema"
```

---

## Task 10: Storage `application-doc` purpose

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/app/api/upload/route.ts`
- Test: `src/lib/storage.test.ts` (existing — add a case)

Candidates upload application documents themselves, but the upload route currently blocks candidates from the only non-resume purpose (`supporting-doc`). Add a new purpose `application-doc` that candidates may use and that accepts documents and images.

- [ ] **Step 1: Write a failing test**

Append to `src/lib/storage.test.ts`:
```ts
describe('application-doc purpose', () => {
  it('allows PDF, Word, and image MIME types', () => {
    const allowed = MIME_BY_PURPOSE['application-doc'];
    expect(allowed).toContain('application/pdf');
    expect(allowed).toContain('image/png');
    expect(allowed).toContain('image/jpeg');
    expect(allowed).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});
```
Ensure `MIME_BY_PURPOSE` is imported in this test file; if not, add it to the existing import from `./storage`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `MIME_BY_PURPOSE['application-doc']` is undefined.

- [ ] **Step 3: Implement the purpose**

In `src/lib/storage.ts`:

1. Change the `Purpose` type to:
```ts
export type Purpose = 'resume' | 'supporting-doc' | 'application-doc';
```

2. Add an `application-doc` entry to `MIME_BY_PURPOSE`, after the `'supporting-doc'` entry:
```ts
  'application-doc': [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ],
```

- [ ] **Step 4: Allow the purpose in the upload route**

In `src/app/api/upload/route.ts`, change the `purposeSchema` line to:
```ts
const purposeSchema = z.enum(['resume', 'supporting-doc', 'application-doc']);
```
The existing role gate (`purpose === 'supporting-doc' && user.role === 'CANDIDATE'` → forbidden) already permits candidates to use `resume` and `application-doc`. No other change to the route.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts src/app/api/upload/route.ts src/lib/storage.test.ts
git commit -m "feat(documents): add application-doc upload purpose"
```

---

## Task 11: `documentService` — apply-time documents, validation, listing

**Files:**
- Create: `src/lib/services/documentService.ts`
- Test: `src/lib/services/documentService.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/services/documentService.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import type { RequiredDocument } from '@/types/requiredDocuments';
import {
  missingRequiredDocuments,
  createAppliedDocuments,
  listApplicationDocuments,
} from './documentService';

const REQ: RequiredDocument[] = [
  { id: 'd1', name: 'Portfolio', required: true },
  { id: 'd2', name: 'Cover note', required: false },
];

async function makeApplication() {
  const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
  const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE' } });
  const job = await prisma.job.create({
    data: {
      title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
      description: 'A description long enough to be valid.', requirements: 'Reqs.',
      status: 'OPEN', postedById: hr.id,
    },
  });
  const app = await prisma.application.create({
    data: { jobId: job.id, candidateUserId: cand.id, stage: 'APPLIED', resumeUrl: 'resume.pdf' },
  });
  return { hr, cand, job, app };
}

describe('missingRequiredDocuments', () => {
  it('returns required docs that have no file', () => {
    const missing = missingRequiredDocuments(REQ, { d2: 'note.pdf' });
    expect(missing.map((d) => d.id)).toEqual(['d1']);
  });

  it('returns nothing when all required docs are provided', () => {
    expect(missingRequiredDocuments(REQ, { d1: 'p.pdf' })).toEqual([]);
  });
});

describe('createAppliedDocuments', () => {
  beforeEach(() => resetDb());

  it('creates SUBMITTED rows only for provided documents', async () => {
    const { app } = await makeApplication();
    await createAppliedDocuments({
      applicationId: app.id,
      requiredDocuments: REQ,
      provided: { d1: 'applications/x/documents/portfolio.pdf' },
    });
    const docs = await listApplicationDocuments(app.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.label).toBe('Portfolio');
    expect(docs[0]?.status).toBe('SUBMITTED');
    expect(docs[0]?.fileUrl).toBe('applications/x/documents/portfolio.pdf');
    expect(docs[0]?.requestedById).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/documentService.test.ts`
Expected: FAIL — `./documentService` does not exist.

- [ ] **Step 3: Implement the service (this slice)**

`src/lib/services/documentService.ts`:
```ts
import { prisma } from '@/lib/prisma';
import type { RequiredDocument } from '@/types/requiredDocuments';

/** Required documents that have no uploaded file in `provided` (keyed by RequiredDocument.id). */
export function missingRequiredDocuments(
  requiredDocuments: RequiredDocument[],
  provided: Record<string, string>,
): RequiredDocument[] {
  return requiredDocuments.filter(
    (d) => d.required && !(typeof provided[d.id] === 'string' && provided[d.id].trim() !== ''),
  );
}

/** Persist one SUBMITTED ApplicationDocument per provided file at apply time. */
export async function createAppliedDocuments(args: {
  applicationId: string;
  requiredDocuments: RequiredDocument[];
  provided: Record<string, string>;
}): Promise<void> {
  const now = new Date();
  const rows = args.requiredDocuments
    .filter((d) => typeof args.provided[d.id] === 'string' && args.provided[d.id].trim() !== '')
    .map((d) => ({
      applicationId: args.applicationId,
      label: d.name,
      instructions: d.instructions ?? null,
      fileUrl: args.provided[d.id],
      status: 'SUBMITTED' as const,
      submittedAt: now,
    }));
  if (rows.length > 0) {
    await prisma.applicationDocument.createMany({ data: rows });
  }
}

/** All documents for one application, oldest first. */
export async function listApplicationDocuments(applicationId: string) {
  return prisma.applicationDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/documentService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/documentService.ts src/lib/services/documentService.test.ts
git commit -m "feat(documents): documentService apply-time creation and listing"
```

---

## Task 12: `documentService` — request and fulfil

**Files:**
- Modify: `src/lib/services/documentService.ts`
- Modify: `src/lib/services/documentService.test.ts`

This task adds the HR-request and candidate-fulfil functions. It depends on the `document-requested` email template, which is added in Task 13 — so the `sendEmail` call here will not type-check until Task 13 is also done. Implement Task 12 and Task 13 together before running the suite (Task 13 ends with the green test run that covers both).

- [ ] **Step 1: Add failing tests**

Append to `src/lib/services/documentService.test.ts` (extend the import from `./documentService` to also import `requestDocument`, `fulfilDocumentRequest`, `listPendingDocumentsForCandidate`):
```ts
describe('requestDocument', () => {
  beforeEach(() => resetDb());

  it('creates a PENDING document and an audit row', async () => {
    const { hr, app } = await makeApplication();
    const r = await requestDocument({
      applicationId: app.id,
      requestedById: hr.id,
      name: 'Government ID',
      instructions: 'A clear photo or scan',
    });
    expect(r.ok).toBe(true);
    const docs = await listApplicationDocuments(app.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.status).toBe('PENDING');
    expect(docs[0]?.fileUrl).toBeNull();
    expect(docs[0]?.requestedById).toBe(hr.id);
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'DOCUMENT_REQUESTED')).toBe(true);
  });

  it('returns APPLICATION_NOT_FOUND for an unknown application', async () => {
    const { hr } = await makeApplication();
    const r = await requestDocument({ applicationId: 'nope', requestedById: hr.id, name: 'X' });
    expect(r).toEqual({ ok: false, reason: 'APPLICATION_NOT_FOUND' });
  });
});

describe('fulfilDocumentRequest', () => {
  beforeEach(() => resetDb());

  it('sets the file and flips status to SUBMITTED', async () => {
    const { hr, cand, app } = await makeApplication();
    const req = await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    if (!req.ok) throw new Error();
    const r = await fulfilDocumentRequest({
      documentId: req.documentId,
      candidateUserId: cand.id,
      fileUrl: 'applications/x/documents/id.pdf',
    });
    expect(r).toEqual({ ok: true });
    const docs = await listApplicationDocuments(app.id);
    expect(docs[0]?.status).toBe('SUBMITTED');
    expect(docs[0]?.fileUrl).toBe('applications/x/documents/id.pdf');
  });

  it('rejects a candidate who does not own the application', async () => {
    const { hr, app } = await makeApplication();
    const intruder = await prisma.user.create({ data: { email: 'i@x.com', name: 'I', role: 'CANDIDATE' } });
    const req = await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    if (!req.ok) throw new Error();
    const r = await fulfilDocumentRequest({
      documentId: req.documentId, candidateUserId: intruder.id, fileUrl: 'x.pdf',
    });
    expect(r).toEqual({ ok: false, reason: 'FORBIDDEN' });
  });
});

describe('listPendingDocumentsForCandidate', () => {
  beforeEach(() => resetDb());

  it('returns only this candidate’s PENDING documents', async () => {
    const { hr, cand, app } = await makeApplication();
    await requestDocument({ applicationId: app.id, requestedById: hr.id, name: 'ID' });
    const pending = await listPendingDocumentsForCandidate(cand.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.label).toBe('ID');
    expect(pending[0]?.application.job.title).toBe('Designer');
  });
});
```

- [ ] **Step 2: Implement the functions**

Append to `src/lib/services/documentService.ts`. First add these imports at the top of the file:
```ts
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
```
Then add:
```ts
export type RequestDocResult =
  | { ok: true; documentId: string }
  | { ok: false; reason: 'APPLICATION_NOT_FOUND' };

/** HR requests an extra document from an applicant. Creates a PENDING row,
 *  audits it, and emails the candidate. */
export async function requestDocument(args: {
  applicationId: string;
  requestedById: string;
  name: string;
  instructions?: string;
}): Promise<RequestDocResult> {
  const app = await prisma.application.findUnique({
    where: { id: args.applicationId },
    include: {
      candidate: { select: { name: true, email: true } },
      job: { select: { title: true } },
    },
  });
  if (!app) return { ok: false, reason: 'APPLICATION_NOT_FOUND' };

  const doc = await prisma.applicationDocument.create({
    data: {
      applicationId: args.applicationId,
      label: args.name,
      instructions: args.instructions ?? null,
      status: 'PENDING',
      requestedById: args.requestedById,
    },
  });

  await recordAudit({
    actorUserId: args.requestedById,
    action: 'DOCUMENT_REQUESTED',
    entityType: 'ApplicationDocument',
    entityId: doc.id,
    metadata: { applicationId: args.applicationId, label: args.name },
  });

  await sendEmail({
    to: app.candidate.email,
    template: 'document-requested',
    data: {
      name: app.candidate.name,
      jobTitle: app.job.title,
      documentName: args.name,
      instructionsBlock: args.instructions ? `<p><em>${args.instructions}</em></p>` : '',
      dashboardUrl: `${process.env.APP_URL ?? ''}/dashboard/candidate`,
    },
  });

  return { ok: true, documentId: doc.id };
}

export type FulfilResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'FORBIDDEN' | 'ALREADY_SUBMITTED' };

/** The owning candidate uploads a file against a PENDING request. */
export async function fulfilDocumentRequest(args: {
  documentId: string;
  candidateUserId: string;
  fileUrl: string;
}): Promise<FulfilResult> {
  const doc = await prisma.applicationDocument.findUnique({
    where: { id: args.documentId },
    include: { application: { select: { candidateUserId: true } } },
  });
  if (!doc) return { ok: false, reason: 'NOT_FOUND' };
  if (doc.application.candidateUserId !== args.candidateUserId) {
    return { ok: false, reason: 'FORBIDDEN' };
  }
  if (doc.status === 'SUBMITTED') return { ok: false, reason: 'ALREADY_SUBMITTED' };

  await prisma.applicationDocument.update({
    where: { id: args.documentId },
    data: { fileUrl: args.fileUrl, status: 'SUBMITTED', submittedAt: new Date() },
  });
  await recordAudit({
    actorUserId: args.candidateUserId,
    action: 'DOCUMENT_SUBMITTED',
    entityType: 'ApplicationDocument',
    entityId: args.documentId,
  });
  return { ok: true };
}

/** Every PENDING document across all of a candidate's applications. */
export async function listPendingDocumentsForCandidate(candidateUserId: string) {
  return prisma.applicationDocument.findMany({
    where: { status: 'PENDING', application: { candidateUserId } },
    orderBy: { createdAt: 'asc' },
    include: {
      application: { include: { job: { select: { id: true, title: true } } } },
    },
  });
}
```

- [ ] **Step 3: Proceed to Task 13**

Do not run the suite yet — `sendEmail` with `template: 'document-requested'` will not type-check until Task 13 registers the template. Task 13 ends with the green run.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/documentService.ts src/lib/services/documentService.test.ts
git commit -m "feat(documents): documentService request, fulfil, and pending list"
```

---

## Task 13: `DOCUMENT_REQUESTED` email template

**Files:**
- Create: `src/emails/templates/document-requested.html`
- Modify: `src/lib/email/templates.ts`

- [ ] **Step 1: Create the HTML template**

`src/emails/templates/document-requested.html`:
```html
<p>Hi {{name}},</p>
<p>Our HR team has requested an additional document for your application to <strong>{{jobTitle}}</strong>:</p>
<p><strong>{{documentName}}</strong></p>
{{instructionsBlock}}
<p>Please upload it from your candidate dashboard so your application can keep moving:</p>
<p><a class="btn" href="{{dashboardUrl}}">Upload document</a></p>
```

- [ ] **Step 2: Register the template type**

In `src/lib/email/templates.ts`:

1. Add an entry to the `TemplateData` type (inside the `type TemplateData = { ... }` block, e.g. after `'application-status-changed'`):
```ts
  'document-requested': {
    name: string;
    jobTitle: string;
    documentName: string;
    instructionsBlock: string;
    dashboardUrl: string;
  };
```

2. Add a subject line to the `subjects` object:
```ts
  'document-requested': (data) => `Action needed: upload ${data.documentName}`,
```

- [ ] **Step 3: Run the document-service suite (covers Tasks 11–13)**

Run: `npx vitest run src/lib/services/documentService.test.ts`
Expected: PASS — all `documentService` tests green, `sendEmail` now type-checks.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/emails/templates/document-requested.html src/lib/email/templates.ts
git commit -m "feat(documents): add DOCUMENT_REQUESTED email template"
```

---

## Task 14: `RequiredDocumentsEditor` and JobForm wiring

**Files:**
- Create: `src/components/jobs/RequiredDocumentsEditor.tsx`
- Modify: `src/components/jobs/JobForm.tsx`
- Modify: `src/app/dashboard/hr/jobs/actions.ts`
- Modify: `src/lib/services/jobService.ts`
- Modify: `src/app/dashboard/hr/jobs/[id]/page.tsx` (the job-edit page that builds JobForm `defaults`)

- [ ] **Step 1: Create the editor component**

`src/components/jobs/RequiredDocumentsEditor.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { RequiredDocument } from '@/types/requiredDocuments';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';

let nextId = 1;
const newId = () => `doc${Date.now()}-${nextId++}`;

export function RequiredDocumentsEditor({
  initialDocuments = [],
}: {
  initialDocuments?: RequiredDocument[];
}) {
  const [docs, setDocs] = useState<RequiredDocument[]>(initialDocuments);

  function add() {
    setDocs([...docs, { id: newId(), name: '', required: true }]);
  }
  function update(idx: number, patch: Partial<RequiredDocument>) {
    setDocs(docs.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function remove(idx: number) {
    setDocs(docs.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="requiredDocumentsJson" value={JSON.stringify(docs)} />
      {docs.map((d, idx) => (
        <div key={d.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">Document</span>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
          <div className="mt-2">
            <Label htmlFor={`docname-${d.id}`}>Document name</Label>
            <Input
              id={`docname-${d.id}`}
              value={d.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="mt-2">
            <Label htmlFor={`docinstr-${d.id}`}>Instructions (optional)</Label>
            <textarea
              id={`docinstr-${d.id}`}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={d.instructions ?? ''}
              onChange={(e) => update(idx, { instructions: e.target.value })}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              id={`docreq-${d.id}`}
              type="checkbox"
              checked={d.required}
              onChange={(e) => update(idx, { required: e.target.checked })}
            />
            <Label htmlFor={`docreq-${d.id}`} className="!font-normal">Required to apply</Label>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={add}>+ Add document</Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire the editor into `JobForm`**

In `src/components/jobs/JobForm.tsx`:

1. Add imports after the `CustomQuestionsEditor` import:
```tsx
import type { RequiredDocument } from '@/types/requiredDocuments';
import { RequiredDocumentsEditor } from './RequiredDocumentsEditor';
```

2. Add `requiredDocuments: RequiredDocument[];` to the `Defaults` type.

3. Add `requiredDocuments: [],` to the `blank` constant.

4. Add this block immediately after the "Custom questions" `<div>`, before the submit `<Button>`:
```tsx
      <div>
        <Label>Required documents</Label>
        <p className="mt-1 text-xs text-slate-500">Optional &mdash; documents candidates must upload when they apply to this role.</p>
        <div className="mt-2">
          <RequiredDocumentsEditor initialDocuments={defaults.requiredDocuments} />
        </div>
      </div>
```

- [ ] **Step 3: Parse the field in the job actions**

In `src/app/dashboard/hr/jobs/actions.ts`, inside `parseJobFormData`, after the `customQuestions` parsing block and before the `jobInputSchema.safeParse(...)` call, add:
```ts
  const requiredDocumentsRaw = String(fd.get('requiredDocumentsJson') ?? '[]');
  let requiredDocuments: unknown = [];
  try {
    requiredDocuments = JSON.parse(requiredDocumentsRaw);
  } catch {
    return null;
  }
```
Then add `requiredDocuments,` to the object passed to `jobInputSchema.safeParse({ ... })`, on the line after `customQuestions,`.

- [ ] **Step 4: Persist the field in `jobService`**

In `src/lib/services/jobService.ts`, in BOTH `createJob` and `updateJob`, add this line to the Prisma `data: { ... }` object, immediately after the `customQuestions:` line:
```ts
      requiredDocuments: parsed.data.requiredDocuments as unknown as Prisma.InputJsonValue,
```

- [ ] **Step 5: Pass current documents to the edit form**

In `src/app/dashboard/hr/jobs/[id]/page.tsx`, find where the `defaults` object for `<JobForm defaults={...}>` is built (it includes a `customQuestions:` entry). Add this line right after the `customQuestions:` line:
```ts
    requiredDocuments: (job.requiredDocuments as unknown as import('@/types/requiredDocuments').RequiredDocument[]) ?? [],
```

- [ ] **Step 6: Verify build and tests**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass (existing `jobService` tests still pass because `requiredDocumentsSchema` has a `.default([])`).

- [ ] **Step 7: Commit**

```bash
git add src/components/jobs/RequiredDocumentsEditor.tsx src/components/jobs/JobForm.tsx src/app/dashboard/hr/jobs/actions.ts src/lib/services/jobService.ts src/app/dashboard/hr/jobs/[id]/page.tsx
git commit -m "feat(documents): let HR define required documents on a job"
```

---

## Task 15: Apply flow — collect required documents

**Files:**
- Modify: `src/lib/services/applicationService.ts`
- Modify: `src/lib/services/applicationService.test.ts`
- Modify: `src/app/jobs/[id]/apply/actions.ts`
- Modify: `src/app/jobs/[id]/apply/ApplyForm.tsx`
- Modify: `src/app/jobs/[id]/apply/page.tsx`

- [ ] **Step 1: Add a failing service test**

Append to `src/lib/services/applicationService.test.ts`:
```ts
describe('submitApplication with required documents', () => {
  beforeEach(() => resetDb());

  async function openJobWithDocs() {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'Cand', role: 'CANDIDATE' } });
    const job = await prisma.job.create({
      data: {
        title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
        description: 'A description long enough to be valid.', requirements: 'Reqs.',
        status: 'OPEN', postedById: hr.id,
        requiredDocuments: [{ id: 'd1', name: 'Portfolio', required: true }],
      },
    });
    return { cand, job };
  }

  it('rejects when a required document is missing', async () => {
    const { cand, job } = await openJobWithDocs();
    const r = await submitApplication({
      jobId: job.id,
      candidateUserId: cand.id,
      input: { jobId: job.id, resumeUrl: 'r.pdf', customAnswers: {} },
      documents: {},
    });
    expect(r).toEqual({ ok: false, reason: 'MISSING_DOCUMENTS' });
  });

  it('creates ApplicationDocument rows when required documents are provided', async () => {
    const { cand, job } = await openJobWithDocs();
    const r = await submitApplication({
      jobId: job.id,
      candidateUserId: cand.id,
      input: { jobId: job.id, resumeUrl: 'r.pdf', customAnswers: {} },
      documents: { d1: 'applications/x/documents/portfolio.pdf' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const docs = await prisma.applicationDocument.findMany({ where: { applicationId: r.applicationId } });
    expect(docs).toHaveLength(1);
    expect(docs[0]?.label).toBe('Portfolio');
    expect(docs[0]?.status).toBe('SUBMITTED');
  });
});
```
Ensure `submitApplication`, `prisma`, `resetDb`, and the Vitest helpers (`beforeEach`, `describe`, `it`, `expect`) are imported in this test file — extend the existing imports if any are missing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/services/applicationService.test.ts`
Expected: FAIL — `submitApplication` has no `documents` parameter and no `MISSING_DOCUMENTS` reason.

- [ ] **Step 3: Extend `submitApplication`**

In `src/lib/services/applicationService.ts`:

1. Add imports at the top:
```ts
import type { RequiredDocument } from '@/types/requiredDocuments';
import { missingRequiredDocuments, createAppliedDocuments } from './documentService';
```

2. Add `'MISSING_DOCUMENTS'` to the `SubmitResult` failure union:
```ts
  | { ok: false; reason: 'JOB_NOT_OPEN' | 'DEADLINE_PASSED' | 'ALREADY_APPLIED' | 'INVALID_ANSWERS' | 'MISSING_DOCUMENTS' | 'CANDIDATE_NOT_FOUND' };
```

3. Add a `documents` field to the `args` parameter type (alongside `jobId`, `candidateUserId`, `input`):
```ts
  documents?: Record<string, string>;
```

4. After the `applicationInputSchema` validation block (after `if (!parsed.success) return { ok: false, reason: 'INVALID_ANSWERS' };`), add:
```ts
  const requiredDocuments = (job.requiredDocuments as unknown as RequiredDocument[]) ?? [];
  const provided = args.documents ?? {};
  if (missingRequiredDocuments(requiredDocuments, provided).length > 0) {
    return { ok: false, reason: 'MISSING_DOCUMENTS' };
  }
```

5. After the application is successfully created (after the `try/catch` that sets `app`), add:
```ts
  await createAppliedDocuments({
    applicationId: app.id,
    requiredDocuments,
    provided,
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/services/applicationService.test.ts`
Expected: PASS.

- [ ] **Step 5: Pass `documents` through the apply action**

In `src/app/jobs/[id]/apply/actions.ts`, after the `customAnswers` parsing block and before the `submitApplication(...)` call, add:
```ts
  const documentsRaw = String(fd.get('documentsJson') ?? '{}');
  let documents: Record<string, string> = {};
  try {
    const parsedDocs = JSON.parse(documentsRaw);
    if (parsedDocs && typeof parsedDocs === 'object' && !Array.isArray(parsedDocs)) {
      documents = parsedDocs as Record<string, string>;
    }
  } catch {
    return { error: 'Could not read your uploaded documents. Try again.' };
  }
```
Then add `documents,` to the `submitApplication({ ... })` call arguments (alongside `jobId`, `candidateUserId`, `input`). Finally, add a branch to the error-message mapping (the `r.reason === ...` ternary chain):
```ts
      r.reason === 'MISSING_DOCUMENTS'   ? 'Please upload all required documents.' :
```

- [ ] **Step 6: Render document uploads in `ApplyForm`**

In `src/app/jobs/[id]/apply/ApplyForm.tsx`:

1. Add the import:
```tsx
import type { RequiredDocument } from '@/types/requiredDocuments';
```

2. Change the component props to accept `requiredDocuments`:
```tsx
export function ApplyForm({
  jobId, questions, requiredDocuments,
}: { jobId: string; questions: CustomQuestion[]; requiredDocuments: RequiredDocument[] }) {
```

3. Add document-upload state inside the component, after the existing `useState` hooks:
```tsx
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  async function onDocChange(docId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'application-doc');
    fd.append('entityId', jobId);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setDocUrls((prev) => ({ ...prev, [docId]: json.relativePath }));
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  const missingRequired = requiredDocuments.some((d) => d.required && !docUrls[d.id]);
```

4. Add this block inside the `<form>`, immediately before the `<CustomAnswersFields ... />` line:
```tsx
        {requiredDocuments.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-900">Required documents</p>
            {requiredDocuments.map((d) => (
              <div key={d.id}>
                <Label htmlFor={`doc-${d.id}`}>
                  {d.name}{d.required ? '' : ' (optional)'}
                </Label>
                {d.instructions && <p className="text-xs text-slate-500">{d.instructions}</p>}
                <input
                  id={`doc-${d.id}`}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                  onChange={(e) => onDocChange(d.id, e)}
                  className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
                />
                {docUrls[d.id] && <p className="mt-1 text-xs text-green-700">Uploaded.</p>}
              </div>
            ))}
          </div>
        )}
        <input type="hidden" name="documentsJson" value={JSON.stringify(docUrls)} />
```

5. Change the submit `<Button>`'s `disabled` prop to also block on missing required documents:
```tsx
      <Button type="submit" disabled={!resumeUrl || uploading || missingRequired}>
```

- [ ] **Step 7: Pass `requiredDocuments` from the apply page**

In `src/app/jobs/[id]/apply/page.tsx`:

1. Add the import:
```tsx
import type { RequiredDocument } from '@/types/requiredDocuments';
```

2. After the `const questions = ...` line, add:
```tsx
  const requiredDocuments = (job.requiredDocuments as unknown as RequiredDocument[]) ?? [];
```

3. Change the `<ApplyForm .../>` usage to:
```tsx
            <ApplyForm jobId={job.id} questions={questions} requiredDocuments={requiredDocuments} />
```

- [ ] **Step 8: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/applicationService.ts src/lib/services/applicationService.test.ts src/app/jobs/[id]/apply/actions.ts src/app/jobs/[id]/apply/ApplyForm.tsx src/app/jobs/[id]/apply/page.tsx
git commit -m "feat(documents): collect required documents in the apply flow"
```

---

## Task 16: HR application detail — documents panel and request form

**Files:**
- Create: `src/app/dashboard/hr/applications/[id]/RequestDocumentForm.tsx`
- Create: `src/app/dashboard/hr/applications/[id]/requestDocumentAction.ts`
- Modify: `src/app/dashboard/hr/applications/[id]/page.tsx`

- [ ] **Step 1: Create the request server action**

`src/app/dashboard/hr/applications/[id]/requestDocumentAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/rbac';
import { requestDocument } from '@/lib/services/documentService';

type FormState = { error?: string; ok?: true };

export async function requestDocumentAction(
  applicationId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireAnyRole(await getSessionUser(), ['SUPER_ADMIN', 'HR_MANAGER']);

  const name = String(fd.get('documentName') ?? '').trim();
  if (!name) return { error: 'Enter a document name.' };
  const instructionsRaw = String(fd.get('instructions') ?? '').trim();

  const r = await requestDocument({
    applicationId,
    requestedById: user.id,
    name,
    instructions: instructionsRaw || undefined,
  });
  if (!r.ok) return { error: 'Could not request the document.' };

  revalidatePath(`/dashboard/hr/applications/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Create the request form component**

`src/app/dashboard/hr/applications/[id]/RequestDocumentForm.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { requestDocumentAction } from './requestDocumentAction';

type FormState = { error?: string; ok?: true };

export function RequestDocumentForm({ applicationId }: { applicationId: string }) {
  const bound = requestDocumentAction.bind(null, applicationId);
  const [state, formAction] = useFormState(bound, {} as FormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Document requested. The candidate has been emailed.</Alert>}
      <div>
        <Label htmlFor="documentName">Document name</Label>
        <Input id="documentName" name="documentName" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="instructions">Instructions (optional)</Label>
        <textarea
          id="instructions"
          name="instructions"
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" size="sm">Request document</Button>
    </form>
  );
}
```

- [ ] **Step 3: Render documents on the HR application detail page**

In `src/app/dashboard/hr/applications/[id]/page.tsx`:

1. Add imports near the other imports:
```tsx
import { listApplicationDocuments } from '@/lib/services/documentService';
import { RequestDocumentForm } from './RequestDocumentForm';
```
   (`Card`, `CardTitle`, and `Badge` are already imported on this page — reuse them.)

2. After the `const interviews = await listInterviewsForApplication(params.id);` line, add:
```tsx
  const documents = await listApplicationDocuments(params.id);
```

3. Add this `<Card>` block inside the returned JSX, after the block that renders custom-question answers (place it among the other detail cards):
```tsx
      <Card>
        <CardTitle>Documents</CardTitle>
        <div className="mt-3 space-y-2">
          {documents.length === 0 && (
            <p className="text-sm text-slate-500">No documents for this application yet.</p>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                {doc.instructions && <p className="text-xs text-slate-500">{doc.instructions}</p>}
              </div>
              {doc.status === 'SUBMITTED' && doc.fileUrl ? (
                <a
                  href={`/api/files/${doc.fileUrl}`}
                  className="text-sm text-brand-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              ) : (
                <Badge tone="amber">Awaiting upload</Badge>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-900">Request a document</p>
          <div className="mt-2">
            <RequestDocumentForm applicationId={params.id} />
          </div>
        </div>
      </Card>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/hr/applications/[id]/RequestDocumentForm.tsx src/app/dashboard/hr/applications/[id]/requestDocumentAction.ts src/app/dashboard/hr/applications/[id]/page.tsx
git commit -m "feat(documents): HR documents panel and request form"
```

---

## Task 17: Candidate dashboard — pending document requests

**Files:**
- Create: `src/components/documents/PendingDocumentUpload.tsx`
- Create: `src/app/dashboard/candidate/uploadDocumentAction.ts`
- Modify: `src/app/dashboard/candidate/page.tsx`

- [ ] **Step 1: Create the upload server action**

`src/app/dashboard/candidate/uploadDocumentAction.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/rbac';
import { fulfilDocumentRequest } from '@/lib/services/documentService';

type FormState = { error?: string; ok?: true };

export async function uploadDocumentAction(
  documentId: string,
  _prev: FormState | undefined,
  fd: FormData,
): Promise<FormState> {
  const user = requireRole(await getSessionUser(), 'CANDIDATE');

  const fileUrl = String(fd.get('fileUrl') ?? '');
  if (!fileUrl) return { error: 'Please choose a file to upload.' };

  const r = await fulfilDocumentRequest({ documentId, candidateUserId: user.id, fileUrl });
  if (!r.ok) {
    const msg =
      r.reason === 'FORBIDDEN'         ? 'You cannot upload to this request.' :
      r.reason === 'ALREADY_SUBMITTED' ? 'This document was already submitted.' :
                                         'Document request not found.';
    return { error: msg };
  }

  revalidatePath('/dashboard/candidate');
  return { ok: true };
}
```

- [ ] **Step 2: Create the upload component**

`src/components/documents/PendingDocumentUpload.tsx`:
```tsx
'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { uploadDocumentAction } from '@/app/dashboard/candidate/uploadDocumentAction';

type FormState = { error?: string; ok?: true };

export function PendingDocumentUpload({
  documentId, label, instructions, jobTitle,
}: { documentId: string; label: string; instructions: string | null; jobTitle: string }) {
  const bound = uploadDocumentAction.bind(null, documentId);
  const [state, formAction] = useFormState(bound, {} as FormState);
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', 'application-doc');
    fd.append('entityId', documentId);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error ?? 'Upload failed.');
        return;
      }
      setFileUrl(json.relativePath);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">For your application to {jobTitle}</p>
      {instructions && <p className="mt-1 text-xs text-slate-600">{instructions}</p>}
      {state.error && <div className="mt-2"><Alert tone="error">{state.error}</Alert></div>}
      <div className="mt-2">
        <Label htmlFor={`file-${documentId}`}>Choose file</Label>
        <input
          id={`file-${documentId}`}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
          onChange={onFileChange}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        {fileUrl && <p className="mt-1 text-xs text-green-700">Ready to submit.</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <input type="hidden" name="fileUrl" value={fileUrl} />
      </div>
      <div className="mt-2">
        <Button type="submit" size="sm" disabled={!fileUrl || uploading}>Submit document</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Render pending requests on the candidate dashboard**

In `src/app/dashboard/candidate/page.tsx`:

1. Add imports:
```tsx
import { listPendingDocumentsForCandidate } from '@/lib/services/documentService';
import { PendingDocumentUpload } from '@/components/documents/PendingDocumentUpload';
```

2. After the `const apps = await listMyApplications(user.id);` line, add:
```tsx
  const pendingDocuments = await listPendingDocumentsForCandidate(user.id);
```

3. Add this block inside the returned JSX, immediately after the `<h1>` welcome heading (and after the `applied === '1'` alert block if present):
```tsx
      {pendingDocuments.length > 0 && (
        <Card>
          <CardTitle>Documents requested</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            HR has asked you to upload the following. Your applications keep moving once they are submitted.
          </p>
          <div className="mt-4 space-y-3">
            {pendingDocuments.map((doc) => (
              <PendingDocumentUpload
                key={doc.id}
                documentId={doc.id}
                label={doc.label}
                instructions={doc.instructions}
                jobTitle={doc.application.job.title}
              />
            ))}
          </div>
        </Card>
      )}
```
   `Card` and `CardTitle` are already imported on this page.

- [ ] **Step 4: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/documents/PendingDocumentUpload.tsx src/app/dashboard/candidate/uploadDocumentAction.ts src/app/dashboard/candidate/page.tsx
git commit -m "feat(documents): candidate dashboard pending document uploads"
```

---

## Task 18: File ACL for application documents

**Files:**
- Modify: `src/lib/services/fileAclService.ts`
- Test: `src/lib/services/fileAclService.test.ts` (existing — add cases)

`GET /api/files/[...path]` must allow the owning candidate to download their own application documents (HR and SUPER_ADMIN are already allowed by the early return in `checkFileAcl`).

- [ ] **Step 1: Add failing tests**

Append to `src/lib/services/fileAclService.test.ts`:
```ts
describe('checkFileAcl — application documents', () => {
  beforeEach(() => resetDb());

  async function makeDoc() {
    const hr = await prisma.user.create({ data: { email: 'hr@x.com', name: 'HR', role: 'HR_MANAGER' } });
    const cand = await prisma.user.create({ data: { email: 'c@x.com', name: 'C', role: 'CANDIDATE' } });
    const job = await prisma.job.create({
      data: {
        title: 'Designer', department: 'Design', locationType: 'REMOTE', type: 'FULL_TIME',
        description: 'A description long enough to be valid.', requirements: 'Reqs.',
        status: 'OPEN', postedById: hr.id,
      },
    });
    const app = await prisma.application.create({
      data: { jobId: job.id, candidateUserId: cand.id, stage: 'APPLIED', resumeUrl: 'r.pdf' },
    });
    await prisma.applicationDocument.create({
      data: { applicationId: app.id, label: 'Portfolio', fileUrl: 'applications/a/documents/p.pdf', status: 'SUBMITTED' },
    });
    return { cand };
  }

  it('allows the owning candidate', async () => {
    const { cand } = await makeDoc();
    const r = await checkFileAcl({
      path: 'applications/a/documents/p.pdf',
      user: { id: cand.id, role: 'CANDIDATE' },
    });
    expect(r).toEqual({ allowed: true });
  });

  it('forbids a different candidate', async () => {
    await makeDoc();
    const other = await prisma.user.create({ data: { email: 'o@x.com', name: 'O', role: 'CANDIDATE' } });
    const r = await checkFileAcl({
      path: 'applications/a/documents/p.pdf',
      user: { id: other.id, role: 'CANDIDATE' },
    });
    expect(r).toEqual({ allowed: false, reason: 'FORBIDDEN' });
  });
});
```
Ensure `checkFileAcl`, `prisma`, `resetDb`, and the Vitest helpers are imported in this test file (extend existing imports if needed).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/services/fileAclService.test.ts`
Expected: FAIL — the owning candidate currently gets `NOT_FOUND` (no branch matches application-document paths).

- [ ] **Step 3: Add the ApplicationDocument branch**

In `src/lib/services/fileAclService.ts`, add this block immediately before the final `return { allowed: false, reason: 'NOT_FOUND' };`:
```ts
  const appDoc = await prisma.applicationDocument.findFirst({
    where: { fileUrl: args.path },
    select: { application: { select: { candidateUserId: true } } },
  });
  if (appDoc) {
    if (appDoc.application.candidateUserId === args.user.id) return { allowed: true };
    return { allowed: false, reason: 'FORBIDDEN' };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/services/fileAclService.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/fileAclService.ts src/lib/services/fileAclService.test.ts
git commit -m "feat(documents): authorize candidates to download their own documents"
```

---

# Final verification

After Task 18, run the full suite and a production build once more, then deploy per the runbook in `README.md` / the project deploy notes (rsync, `npm ci`, `npx prisma migrate deploy`, `npm run build`, `pm2 restart`). The `add_application_documents` migration must be applied to the production database during deploy.

- [ ] `npm test` — all green
- [ ] `npm run build` — succeeds
- [ ] Manual smoke test: create a job with a required document, apply as a candidate, confirm the application is blocked without the document and succeeds with it; request a document as HR and upload it as the candidate; confirm the four new public pages render.
