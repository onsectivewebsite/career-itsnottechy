export type IcsInput = {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes: number;
  organizerEmail: string;
  organizerName: string;
};

/**
 * Build a minimal RFC 5545 VCALENDAR/VEVENT block.
 *
 * Output uses CRLF line endings (mail clients expect that when the body is
 * attached as text/calendar). We skip line-folding at column 75 because all
 * fields are short enough that folding never triggers in practice.
 */
export function buildIcs(input: IcsInput): string {
  const dtstamp = formatUtc(new Date());
  const dtstart = formatUtc(input.start);
  const dtend = formatUtc(new Date(input.start.getTime() + input.durationMinutes * 60_000));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ItsNotTechy//Careers//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    `LOCATION:${escapeText(input.location)}`,
    `ORGANIZER;CN=${input.organizerName}:mailto:${input.organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

function formatUtc(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm   = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd   = d.getUTCDate().toString().padStart(2, '0');
  const hh   = d.getUTCHours().toString().padStart(2, '0');
  const mi   = d.getUTCMinutes().toString().padStart(2, '0');
  const ss   = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
