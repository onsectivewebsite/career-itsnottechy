# Phase 9 — Content Polish, WYSIWYG Job Editor & Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the company founding year, add a Leadership page, expand the footer and Home page, give HR a WYSIWYG editor for job Description/Requirements (stored as sanitized HTML), and commit a feature roadmap.

**Architecture:** Part A is static React Server Components — no dependencies. Part B adds TipTap (WYSIWYG), `sanitize-html` (server-side sanitisation), `html-react-parser` (renders HTML as React elements), and the Tailwind typography plugin (so formatted content displays correctly); job rich text is stored as sanitized HTML in the existing `description`/`requirements` columns — no DB migration. Part C is a documentation file.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Zod, Tailwind, TipTap 2, Vitest.

**Conventions for every task:**
- Node/npm/npx come from nvm — prefix EVERY `npm`/`npx` command with `PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.
- `npm test` runs the full Vitest suite; `npx vitest run <path>` runs one file.
- Commit after every task with the message in its final step.
- Spec: `docs/superpowers/specs/2026-05-20-phase-9-content-and-rich-editor-design.md`.

---

# Part A — Content & branding

## Task 1: Leadership & Departments page

**Files:**
- Create: `src/app/leadership/page.tsx`

- [ ] **Step 1: Create the page**

`src/app/leadership/page.tsx`:
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Leadership & Departments · It’s Not Techy Careers',
  description: 'How It’s Not Techy is led, and the departments that deliver the work.',
};

const PRINCIPLES: { title: string; body: string }[] = [
  { title: 'Practitioners own outcomes', body: 'Senior people lead the work directly and are accountable for the result — not for hours billed.' },
  { title: 'Flat and transparent', body: 'Decisions are made close to the work, in the open. Scopes, timelines, and trade-offs are shared.' },
  { title: 'Measured by impact', body: 'Teams are judged on pipeline and revenue moved for clients, not on vanity metrics.' },
  { title: 'Managers coach, not gate', body: 'Management exists to remove blockers and grow people — not to sit between the team and the work.' },
];

const DEPARTMENTS: string[] = [
  'Web Design & Development',
  'SEO',
  'Social Media',
  'Video Production',
  'Brand Design',
  'Performance Marketing',
  'Marketing Platforms',
  'AI Marketing',
];

export default function LeadershipPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">How we run</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Leadership &amp; Departments</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              It&apos;s Not Techy is led by the people doing the work — a flat, senior team organised
              into focused departments.
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold text-slate-900">How we lead</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
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
            <h2 className="text-2xl font-bold text-slate-900">Our departments</h2>
            <p className="mt-2 text-slate-600">Each department is staffed by senior practitioners and works as one connected team.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DEPARTMENTS.map((d) => (
                <div key={d} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900">
                  {d}
                </div>
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
Expected: build succeeds and lists `/leadership`.

- [ ] **Step 3: Commit**

```bash
git add src/app/leadership/page.tsx
git commit -m "feat(public): add Leadership & Departments page"
```

---

## Task 2: Link Leadership from PublicNav

**Files:**
- Modify: `src/components/PublicNav.tsx`

- [ ] **Step 1: Add the nav link**

In `src/components/PublicNav.tsx`, inside the `<nav>` element, add a Leadership link immediately after the `/life` ("Life") link:
```tsx
          <Link href="/leadership" className="text-slate-700 hover:text-slate-900">Leadership</Link>
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicNav.tsx
git commit -m "feat(public): link Leadership page from nav"
```

---

## Task 3: Expanded multi-column footer

**Files:**
- Modify: `src/components/PublicFooter.tsx`

- [ ] **Step 1: Replace the footer with a multi-column layout**

Replace the entire contents of `src/components/PublicFooter.tsx` with:
```tsx
import Link from 'next/link';

const EXPLORE: { href: string; label: string }[] = [
  { href: '/culture', label: 'Culture & Belonging' },
  { href: '/benefits', label: 'Benefits & Perks' },
  { href: '/resources', label: 'Candidate Resources' },
  { href: '/life', label: 'Life & Offices' },
  { href: '/leadership', label: 'Leadership & Departments' },
];

const CANDIDATE: { href: string; label: string }[] = [
  { href: '/jobs', label: 'Open roles' },
  { href: '/login', label: 'Sign in' },
  { href: '/register', label: 'Create account' },
];

export function PublicFooter() {
  return (
    <footer className="bg-ink-600">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-light-cropped.png" alt="It's Not Techy" className="h-9 w-auto" />
            <p className="mt-4 text-sm text-slate-400">Digital marketing that speaks human.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <ul className="mt-3 space-y-2">
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">For candidates</h3>
            <ul className="mt-3 space-y-2">
              {CANDIDATE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
            <address className="mt-3 space-y-2 text-sm not-italic text-slate-300">
              <p>1111 Albion Rd, Etobicoke,<br />ON M9V 2X3, Canada</p>
              <p><a href="tel:+16726737900" className="hover:text-white">+1 672-673-7900</a></p>
              <p><a href="mailto:info@itsnottechy.com" className="hover:text-white">info@itsnottechy.com</a></p>
            </address>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
          © {new Date().getFullYear()} It&apos;s Not Techy. Digital marketing that speaks human.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicFooter.tsx
git commit -m "feat(public): expand footer into multi-column layout with contact"
```

---

## Task 4: Home page — founding year + new sections

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Fix the founding year**

In `src/app/page.tsx`:
- In the About paragraph, change `Founded in 2024` to `Founded in 2026`.
- Change `<Stat value="2024" label="Founded" />` to `<Stat value="2026" label="Founded" />`.

- [ ] **Step 2: Add two sections before the "Explore" section**

In `src/app/page.tsx`, immediately before the `{/* Explore the company */}` section, insert:
```tsx
        {/* How hiring works */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">The process</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">How hiring works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <HiringStep n="1" title="Apply" body="Submit your application and any documents the role asks for." />
              <HiringStep n="2" title="Review" body="A hiring manager reads every application by hand." />
              <HiringStep n="3" title="Interview" body="One or two conversations with the team you'd join." />
              <HiringStep n="4" title="Offer" body="A clear written offer — usually within two to three weeks." />
            </div>
          </div>
        </section>

        {/* Leadership teaser */}
        <section className="bg-ink-600">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">Led by the people doing the work</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Flat, senior, and organised into focused departments — management here exists to remove
              blockers and grow people.
            </p>
            <div className="mt-8">
              <Link href="/leadership">
                <Button size="lg" variant="secondary">How we&apos;re organised</Button>
              </Link>
            </div>
          </div>
        </section>
```

- [ ] **Step 3: Add the `HiringStep` helper**

At the end of `src/app/page.tsx`, after the `ExploreCard` function, add:
```tsx
function HiringStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(public): correct founding year to 2026 and expand Home"
```

---

# Part B — WYSIWYG job editor

## Task 5: Add dependencies and Tailwind typography

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
npm install @tiptap/react@^2 @tiptap/pm@^2 @tiptap/starter-kit@^2 @tiptap/extension-link@^2 sanitize-html html-react-parser
```
Expected: installs succeed, `package.json` `dependencies` gains the six packages.

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D @types/sanitize-html @tailwindcss/typography
```
Expected: `package.json` `devDependencies` gains both.

- [ ] **Step 3: Enable the typography plugin**

In `tailwind.config.ts`, change the `plugins` line from `plugins: [],` to:
```ts
  plugins: [require('@tailwindcss/typography')],
```
This makes the `prose` class (already used on the job-detail page and by the editor) actually style headings and lists.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tailwind.config.ts
git commit -m "chore(deps): add TipTap, sanitize-html, html-react-parser, typography plugin"
```

---

## Task 6: `richText.ts` — sanitisation and text helpers

**Files:**
- Create: `src/lib/richText.ts`
- Test: `src/lib/richText.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/richText.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml, htmlToText } from './richText';

describe('sanitizeRichHtml', () => {
  it('keeps allowed formatting tags', () => {
    const out = sanitizeRichHtml('<h2>Role</h2><p><strong>Bold</strong> and <em>it</em></p><ul><li>one</li></ul>');
    expect(out).toContain('<h2>Role</h2>');
    expect(out).toContain('<strong>Bold</strong>');
    expect(out).toContain('<li>one</li>');
  });

  it('strips script tags and event-handler attributes', () => {
    const out = sanitizeRichHtml('<p onclick="evil()">hi</p><script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('hi');
  });

  it('forces rel/target on links and drops javascript: URLs', () => {
    const ok = sanitizeRichHtml('<a href="https://x.com">x</a>');
    expect(ok).toContain('rel="noopener noreferrer"');
    expect(ok).toContain('target="_blank"');
    const bad = sanitizeRichHtml('<a href="javascript:alert(1)">x</a>');
    expect(bad).not.toContain('javascript:');
  });

  it('handles empty/undefined input', () => {
    expect(sanitizeRichHtml('')).toBe('');
  });
});

describe('htmlToText', () => {
  it('strips tags to spaced plain text', () => {
    expect(htmlToText('<h2>Title</h2><p>Body <strong>text</strong></p>')).toBe('Title Body text');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToText('')).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/richText.test.ts`
Expected: FAIL — `./richText` does not exist.

- [ ] **Step 3: Implement the helpers**

`src/lib/richText.ts`:
```ts
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

/** Sanitise editor HTML against a strict allowlist before storing or rendering. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html ?? '', SANITIZE_OPTIONS);
}

/** Convert rich HTML to a single-line plain-text string (for excerpts and length checks). */
export function htmlToText(html: string): string {
  const withBreaks = (html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|ul|ol|div)>/gi, ' ');
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/richText.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/richText.ts src/lib/richText.test.ts
git commit -m "feat(richtext): add sanitizeRichHtml and htmlToText helpers"
```

---

## Task 7: `RichTextEditor` client component

**Files:**
- Create: `src/components/ui/RichTextEditor.tsx`

- [ ] **Step 1: Create the editor component**

`src/components/ui/RichTextEditor.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

function TB({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-medium ${active ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ name, initialHtml }: { name: string; initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none min-h-[160px] rounded-b-md border border-slate-300 px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  if (!editor) return null;

  function setLink() {
    const url = window.prompt('Link URL (leave blank to remove)');
    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-slate-300 bg-slate-100 p-1">
        <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</TB>
        <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</TB>
        <TB active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</TB>
        <TB active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</TB>
        <TB active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</TB>
        <TB active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</TB>
        <TB active={editor.isActive('link')} onClick={setLink}>Link</TB>
        <TB onClick={() => editor.chain().focus().undo().run()}>Undo</TB>
        <TB onClick={() => editor.chain().focus().redo().run()}>Redo</TB>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds (the component compiles even though nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/RichTextEditor.tsx
git commit -m "feat(richtext): add TipTap RichTextEditor component"
```

---

## Task 8: `RichText` render component

**Files:**
- Create: `src/components/RichText.tsx`

- [ ] **Step 1: Create the component**

`src/components/RichText.tsx`:
```tsx
import parse from 'html-react-parser';
import { sanitizeRichHtml } from '@/lib/richText';

/** Renders stored job HTML as React elements. Sanitises on render as defence in depth. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={className ?? 'prose max-w-none text-slate-700'}>{parse(sanitizeRichHtml(html))}</div>;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/RichText.tsx
git commit -m "feat(richtext): add RichText render component"
```

---

## Task 9: Wire RichTextEditor into JobForm

**Files:**
- Modify: `src/components/jobs/JobForm.tsx`

- [ ] **Step 1: Add the import**

In `src/components/jobs/JobForm.tsx`, add after the `RequiredDocumentsEditor` import:
```tsx
import { RichTextEditor } from '@/components/ui/RichTextEditor';
```

- [ ] **Step 2: Replace the Description field**

Replace the entire Description `<div>` block:
```tsx
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaults.description} required rows={6}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
```
with:
```tsx
      <div>
        <Label>Description</Label>
        <div className="mt-1">
          <RichTextEditor name="description" initialHtml={defaults.description} />
        </div>
      </div>
```

- [ ] **Step 3: Replace the Requirements field**

Replace the entire Requirements `<div>` block:
```tsx
      <div>
        <Label htmlFor="requirements">Requirements</Label>
        <textarea id="requirements" name="requirements" defaultValue={defaults.requirements} required rows={4}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
```
with:
```tsx
      <div>
        <Label>Requirements</Label>
        <div className="mt-1">
          <RichTextEditor name="requirements" initialHtml={defaults.requirements} />
        </div>
      </div>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/jobs/JobForm.tsx
git commit -m "feat(richtext): use RichTextEditor for job description and requirements"
```

---

## Task 10: Validate rich-text length by text content

**Files:**
- Modify: `src/lib/validation/jobs.ts`
- Modify: `src/lib/validation/jobs.test.ts`

The current schema enforces `min(20)` / `min(10)` on the raw string. With HTML, `<p></p>` (visually empty) is 7 characters and would wrongly pass. Validate the *text content* instead.

- [ ] **Step 1: Add failing tests**

Append to `src/lib/validation/jobs.test.ts`:
```ts
describe('jobInputSchema rich-text length', () => {
  const base = {
    title: 'Engineer', department: 'Engineering', locationType: 'REMOTE' as const,
    type: 'FULL_TIME' as const, currency: 'USD', customQuestions: [],
  };

  it('accepts HTML whose text content is long enough', () => {
    const r = jobInputSchema.safeParse({
      ...base,
      description: '<p>We build practical software for working teams.</p>',
      requirements: '<p>Three years backend.</p>',
    });
    expect(r.success).toBe(true);
  });

  it('rejects rich text with enough raw characters but no real text', () => {
    // 28 raw characters (passes the old min(20)) but zero text content.
    const r = jobInputSchema.safeParse({
      ...base,
      description: '<p></p><p></p><p></p><p></p>',
      requirements: '<p>Three years backend.</p>',
    });
    expect(r.success).toBe(false);
  });
});
```
Ensure `jobInputSchema` is imported in this test file (it already is for existing tests).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/jobs.test.ts`
Expected: FAIL — under the current schema the tag-only `'<p></p><p></p><p></p><p></p>'` description is 28 characters, so `min(20)` accepts it and `r.success` is `true`, failing the `toBe(false)` assertion. (The "accepts HTML" case passes already and guards against regressions.)

- [ ] **Step 3: Update the schema**

In `src/lib/validation/jobs.ts`:

1. Add the import at the top:
```ts
import { htmlToText } from '@/lib/richText';
```

2. Change the `description` and `requirements` lines in `jobInputSchema` from:
```ts
  description:  z.string().min(20).max(20000),
  requirements: z.string().min(10).max(20000),
```
to:
```ts
  description:  z.string().max(20000),
  requirements: z.string().max(20000),
```

3. Inside the existing `.superRefine((data, ctx) => { ... })` block of `jobInputSchema`, add at the top of the function body:
```ts
  if (htmlToText(data.description).length < 20) {
    ctx.addIssue({ code: 'custom', path: ['description'], message: 'Description is too short' });
  }
  if (htmlToText(data.requirements).length < 10) {
    ctx.addIssue({ code: 'custom', path: ['requirements'], message: 'Requirements are too short' });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/jobs.test.ts`
Expected: PASS. The existing `jobService` tests use plain-text fixtures (e.g. `description: 'We build practical software for working teams.'`) — `htmlToText` of plain text returns it unchanged, so those remain valid.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/jobs.ts src/lib/validation/jobs.test.ts
git commit -m "feat(richtext): validate job description/requirements by text length"
```

---

## Task 11: Sanitise job HTML on save

**Files:**
- Modify: `src/lib/services/jobService.ts`

- [ ] **Step 1: Add the import**

In `src/lib/services/jobService.ts`, add after the existing imports:
```ts
import { sanitizeRichHtml } from '@/lib/richText';
```

- [ ] **Step 2: Sanitise in `createJob`**

In `createJob`, in the `prisma.job.create({ data: { ... } })` call, change:
```ts
      description: parsed.data.description,
      requirements: parsed.data.requirements,
```
to:
```ts
      description: sanitizeRichHtml(parsed.data.description),
      requirements: sanitizeRichHtml(parsed.data.requirements),
```

- [ ] **Step 3: Sanitise in `updateJob`**

In `updateJob`, in the `prisma.job.update({ ... data: { ... } })` call, make the identical change to the `description` and `requirements` lines:
```ts
      description: sanitizeRichHtml(parsed.data.description),
      requirements: sanitizeRichHtml(parsed.data.requirements),
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests pass. `jobService` tests use plain-text fixtures; `sanitizeRichHtml` leaves tag-free text unchanged, so assertions on `title`/status still hold.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/jobService.ts
git commit -m "feat(richtext): sanitize job description and requirements on save"
```

---

## Task 12: Render rich text on the job pages

**Files:**
- Modify: `src/app/jobs/[id]/page.tsx`
- Modify: `src/app/jobs/page.tsx`

- [ ] **Step 1: Render rich HTML on the job detail page**

In `src/app/jobs/[id]/page.tsx`:

1. Add the import after the existing imports:
```tsx
import { RichText } from '@/components/RichText';
```

2. In the `<section className="prose mt-8 max-w-none">` block, replace:
```tsx
          <p className="whitespace-pre-wrap text-slate-700">{job.description}</p>
```
with:
```tsx
          <RichText html={job.description} />
```

3. And replace:
```tsx
          <p className="whitespace-pre-wrap text-slate-700">{job.requirements}</p>
```
with:
```tsx
          <RichText html={job.requirements} />
```

- [ ] **Step 2: Use plain text for the jobs-list excerpt**

In `src/app/jobs/page.tsx`:

1. Add the import after the existing imports:
```tsx
import { htmlToText } from '@/lib/richText';
```

2. Change the excerpt line:
```tsx
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{job.description}</p>
```
to:
```tsx
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{htmlToText(job.description)}</p>
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/jobs/[id]/page.tsx src/app/jobs/page.tsx
git commit -m "feat(richtext): render formatted job description on public pages"
```

---

# Part C — Roadmap

## Task 13: Commit the feature roadmap

**Files:**
- Create: `docs/superpowers/roadmap.md`

- [ ] **Step 1: Create the roadmap document**

`docs/superpowers/roadmap.md`:
```markdown
# ItsNotTechy Careers — Feature Roadmap

A prioritised backlog of post-Phase-9 work. Reference only — nothing here is committed
until brainstormed and planned. Updated 2026-05-20.

## P0 — next up

- **Saved jobs & job alerts** — let candidates save roles and opt into email alerts for new matching postings. Drives return visits and applications.
- **HR bulk stage actions** — move/reject multiple applicants at once from the applicants list. Removes the biggest repetitive-click cost for HR.
- **Reusable HR email templates** — canned messages (rejection, interview invite, offer) HR can pick and personalise instead of writing each time.
- **Application withdrawal** — let a candidate withdraw an application from their dashboard, keeping pipeline data honest.

## P1 — soon after

- **Interview scorecards** — structured per-interview feedback (criteria + rating + notes) so hiring decisions are evidence-based.
- **Analytics dashboard** — time-to-hire, pipeline funnel conversion, and source breakdown for HR and admins.
- **Reusable candidate profile** — skills, links, and a default resume stored once and reused across applications.
- **Job templates / clone** — start a new posting from an existing one to cut HR setup time.
- **Offer-letter generation + e-acceptance** — generate an offer document and let the candidate accept online.

## P2 — later

- **Job SEO** — sitemap entries and JobPosting structured data so roles surface in search and job aggregators.
- **Calendar integration** — push scheduled interviews to Google/Outlook calendars.
- **Embeddable careers widget** — a snippet that shows open roles on the main itsnottechy.com site.
- **Staff SSO** — single sign-on for internal users.
- **Talent pool** — re-engage strong past candidates when a matching role opens.

## Platform hardening

- **Redis-backed rate limiting** — replace the in-memory limiter so limits hold across multiple app instances.
- **Background job queue for email** — decouple sending from the request path; retry failures.
- **Audit-log retention & export** — scheduled archival/export of `AuditLog` rows.
- **Automated database backups** — replace the manual cron suggestion with an installed, monitored backup job.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/roadmap.md
git commit -m "docs: add prioritised feature roadmap"
```

---

# Final verification

After Task 13:

- [ ] `npm test` — all green
- [ ] `npm run build` — succeeds
- [ ] Manual smoke test: create a job, format the Description with a heading, bold text, and a bullet list; save; confirm the public job page renders the formatting and the jobs list shows a clean plain-text excerpt; confirm `/leadership` renders and is linked from the nav and footer; confirm the Home page shows "Founded in 2026".

Then deploy per the runbook: rsync, `npm ci` (picks up the new dependencies), `npm run build`, `pm2 restart`. No database migration is required for this phase.
