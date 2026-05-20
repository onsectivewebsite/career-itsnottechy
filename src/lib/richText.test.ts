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
