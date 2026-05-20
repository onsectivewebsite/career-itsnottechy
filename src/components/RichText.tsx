'use client';

import parse from 'html-react-parser';
import { sanitizeRichHtml } from '@/lib/richText';

/** Renders stored job HTML as React elements. Sanitises on render as defence in depth. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={className ?? 'prose max-w-none text-slate-700'}>{parse(sanitizeRichHtml(html))}</div>;
}
