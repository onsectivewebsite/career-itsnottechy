import { describe, expect, it } from 'vitest';
import { buildIcs } from './buildIcs';

describe('buildIcs', () => {
  const base = {
    uid: 'interview-cuid-123@itsnottechy.com',
    title: 'Interview: Jordan Reed — Software Engineer',
    description: 'Video interview with HR.\nLink: https://meet.example.com/abc',
    location: 'https://meet.example.com/abc',
    start: new Date('2026-06-01T14:00:00.000Z'),
    durationMinutes: 45,
    organizerEmail: 'hr@itsnottechy.com',
    organizerName: 'ItsNotTechy HR',
  };

  it('produces a VCALENDAR with required fields', () => {
    const ics = buildIcs(base);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('UID:interview-cuid-123@itsnottechy.com');
    expect(ics).toContain('DTSTART:20260601T140000Z');
    expect(ics).toContain('DTEND:20260601T144500Z');
    expect(ics).toContain('SUMMARY:Interview: Jordan Reed');
    expect(ics).toContain('LOCATION:https://meet.example.com/abc');
    expect(ics).toContain('ORGANIZER;CN=ItsNotTechy HR:mailto:hr@itsnottechy.com');
  });

  it('escapes commas, semicolons, and newlines per RFC 5545', () => {
    const ics = buildIcs({ ...base, title: 'A; B, C\nD', description: 'x; y, z\n' });
    expect(ics).toContain('SUMMARY:A\\; B\\, C\\nD');
    expect(ics).toContain('DESCRIPTION:x\\; y\\, z\\n');
  });

  it('uses CRLF line endings (RFC 5545 §3.1)', () => {
    const ics = buildIcs(base);
    expect(ics).toMatch(/BEGIN:VCALENDAR\r\n/);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('computes DTEND correctly for non-45 durations', () => {
    const ics = buildIcs({ ...base, durationMinutes: 30 });
    expect(ics).toContain('DTSTART:20260601T140000Z');
    expect(ics).toContain('DTEND:20260601T143000Z');
  });
});
