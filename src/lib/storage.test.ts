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

const validPdfBuf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10)]);

describe('saveUploadedFile', () => {
  it('writes the file under <root>/<purpose>/<entityId>/<random>-<original>', async () => {
    const r = await saveUploadedFile({
      buffer: validPdfBuf,
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
    expect(fs.existsSync(absolute)).toBe(true);
  });

  it('rejects oversize files', async () => {
    // Oversize check runs before magic-byte check, so content doesn't matter here.
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
      buffer: validPdfBuf,
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

describe('saveUploadedFile magic-byte check', () => {
  it('rejects a buffer whose declared MIME does not match its bytes', async () => {
    const fakeJpeg = Buffer.from('definitely-not-an-image');
    const r = await saveUploadedFile({
      buffer: fakeJpeg,
      originalFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      purpose: 'supporting-doc',
      entityId: 'test',
    });
    expect(r).toEqual({ ok: false, reason: 'MIME_MISMATCH' });
  });

  it('accepts a real PDF magic prefix', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100)]);
    const r = await saveUploadedFile({
      buffer: pdf,
      originalFilename: 'doc.pdf',
      mimeType: 'application/pdf',
      purpose: 'supporting-doc',
      entityId: 'test-' + Math.random().toString(36).slice(2),
    });
    expect(r.ok).toBe(true);
  });
});
