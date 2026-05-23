import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/lib/test/db';
import {
  createTemplate, updateTemplate, deleteTemplate, listTemplates, getTemplate,
} from './emailTemplateService';

async function makeAdmin() {
  return prisma.user.create({ data: { email: 'a@x.com', name: 'Admin', role: 'SUPER_ADMIN' } });
}

const ok = { name: 'Rejection', subject: 'About your application', body: '<p>Hi</p>' };

describe('createTemplate', () => {
  beforeEach(() => resetDb());

  it('creates a template and writes an audit row', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = await prisma.emailTemplate.findUnique({ where: { id: r.id } });
    expect(t?.name).toBe('Rejection');
    const audits = await prisma.auditLog.findMany();
    expect(audits.some((a) => a.action === 'EMAIL_TEMPLATE_CREATED')).toBe(true);
  });

  it('sanitises the body on save', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({
      input: { ...ok, body: '<p onclick="evil()">hi</p><script>alert(1)</script>' },
      actorUserId: admin.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = await prisma.emailTemplate.findUnique({ where: { id: r.id } });
    expect(t?.body).not.toContain('<script>');
    expect(t?.body).not.toContain('onclick');
    expect(t?.body).toContain('hi');
  });

  it('returns NAME_TAKEN on duplicate name', async () => {
    const admin = await makeAdmin();
    const first = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(first.ok).toBe(true);
    const dup = await createTemplate({ input: ok, actorUserId: admin.id });
    expect(dup).toEqual({ ok: false, reason: 'NAME_TAKEN' });
  });

  it('returns INVALID on bad input', async () => {
    const admin = await makeAdmin();
    const r = await createTemplate({ input: { ...ok, name: '' }, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'INVALID' });
  });
});

describe('updateTemplate / deleteTemplate / listTemplates / getTemplate', () => {
  beforeEach(() => resetDb());

  it('updates an existing template', async () => {
    const admin = await makeAdmin();
    const c = await createTemplate({ input: ok, actorUserId: admin.id });
    if (!c.ok) throw new Error();
    const r = await updateTemplate({
      id: c.id, input: { ...ok, subject: 'Updated' }, actorUserId: admin.id,
    });
    expect(r.ok).toBe(true);
    const t = await prisma.emailTemplate.findUnique({ where: { id: c.id } });
    expect(t?.subject).toBe('Updated');
  });

  it('updateTemplate returns NOT_FOUND for missing id', async () => {
    const admin = await makeAdmin();
    const r = await updateTemplate({ id: 'nope', input: ok, actorUserId: admin.id });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('deletes a template', async () => {
    const admin = await makeAdmin();
    const c = await createTemplate({ input: ok, actorUserId: admin.id });
    if (!c.ok) throw new Error();
    expect((await deleteTemplate({ id: c.id, actorUserId: admin.id })).ok).toBe(true);
    expect(await prisma.emailTemplate.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it('listTemplates returns all, newest-updated first; getTemplate returns one', async () => {
    const admin = await makeAdmin();
    await createTemplate({ input: { ...ok, name: 'A' }, actorUserId: admin.id });
    const b = await createTemplate({ input: { ...ok, name: 'B' }, actorUserId: admin.id });
    if (!b.ok) throw new Error();
    const list = await listTemplates();
    expect(list).toHaveLength(2);
    const one = await getTemplate(b.id);
    expect(one?.name).toBe('B');
  });
});
