import { describe, expect, it } from 'vitest';
import { renderTemplate, subjectFor } from './templates';

describe('renderTemplate', () => {
  it('renders invite-staff with substitutions and the layout', () => {
    const html = renderTemplate('invite-staff', {
      name: 'Alice',
      roleLabel: 'HR Manager',
      acceptUrl: 'https://x.com/invite/abc',
    });
    expect(html).toContain('Alice');
    expect(html).toContain('HR Manager');
    expect(html).toContain('https://x.com/invite/abc');
    expect(html).toContain('ItsNotTechy Careers');
  });

  it('renders welcome-candidate', () => {
    const html = renderTemplate('welcome-candidate', {
      name: 'Bob',
      dashboardUrl: 'https://x.com/dashboard/candidate',
    });
    expect(html).toContain('Bob');
    expect(html).toContain('https://x.com/dashboard/candidate');
  });

  it('renders password-reset', () => {
    const html = renderTemplate('password-reset', {
      name: 'Carol',
      resetUrl: 'https://x.com/reset/xyz',
    });
    expect(html).toContain('Carol');
    expect(html).toContain('https://x.com/reset/xyz');
  });

  it('HTML-escapes user data', () => {
    const html = renderTemplate('welcome-candidate', {
      name: '<script>',
      dashboardUrl: 'https://x.com/d',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('subjectFor', () => {
  it('returns subjects per template', () => {
    expect(subjectFor('invite-staff', { name: 'A', roleLabel: 'X', acceptUrl: '' }))
      .toBe("You're invited to ItsNotTechy Careers");
    expect(subjectFor('welcome-candidate', { name: 'A', dashboardUrl: '' }))
      .toBe('Welcome to ItsNotTechy Careers');
    expect(subjectFor('password-reset', { name: 'A', resetUrl: '' }))
      .toBe('Reset your ItsNotTechy Careers password');
  });
});

describe('renderTemplate interview-scheduled', () => {
  const baseData = {
    recipientName: 'Carol',
    candidateName: 'Jordan Reed',
    jobTitle: 'Software Engineer',
    whenHuman: 'Mon, 01 Jun 2026 14:00:00 UTC',
    durationMinutes: '45',
    formatLabel: 'Video',
    locationLabel: 'Meeting link',
    locationOrLink: 'https://meet.example.com/abc',
    notesBlock: '',
  };

  it('renders without notes', () => {
    const html = renderTemplate('interview-scheduled', baseData);
    expect(html).toContain('Carol');
    expect(html).toContain('Jordan Reed');
    expect(html).toContain('Software Engineer');
    expect(html).toContain('Meeting link');
    expect(html).toContain('https://meet.example.com/abc');
    // No notes paragraph
    expect(html).not.toContain('Notes:');
  });

  it('renders the notesBlock as raw HTML (not escaped)', () => {
    const html = renderTemplate('interview-scheduled', {
      ...baseData,
      notesBlock: '<p><strong>Notes:</strong> please be ready</p>',
    });
    // Raw HTML: opening tag preserved, no &lt; entities
    expect(html).toContain('<p><strong>Notes:</strong> please be ready</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });

  it('subject includes candidate and job title', () => {
    expect(subjectFor('interview-scheduled', baseData))
      .toBe('Interview scheduled — Jordan Reed for Software Engineer');
  });
});
