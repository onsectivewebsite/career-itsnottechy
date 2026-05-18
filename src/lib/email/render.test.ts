import { describe, expect, it } from 'vitest';
import { interpolate, wrapInLayout, escapeHtml } from './render';

describe('escapeHtml', () => {
  it("escapes &<>\"'", () => {
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
