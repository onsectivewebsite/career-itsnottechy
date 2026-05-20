import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
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
