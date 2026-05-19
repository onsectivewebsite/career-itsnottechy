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

describe('renderTemplate promotion-submitted', () => {
  it('renders submitter + employee + title transition', () => {
    const html = renderTemplate('promotion-submitted', {
      recipientName: 'Manager Mike',
      employeeName: 'Alice',
      currentTitle: 'Engineer II',
      targetTitle: 'Senior Engineer',
      contextLine: 'Please review this request and decide.',
      dashboardUrl: 'https://x.com/dashboard/manager/promotions',
    });
    expect(html).toContain('Manager Mike');
    expect(html).toContain('Alice');
    expect(html).toContain('Engineer II');
    expect(html).toContain('Senior Engineer');
    expect(html).toContain('Please review this request and decide.');
  });

  it('subject contains employee name and title transition', () => {
    expect(subjectFor('promotion-submitted', {
      recipientName: 'r', employeeName: 'Alice',
      currentTitle: 'Engineer II', targetTitle: 'Senior Engineer',
      contextLine: 'x', dashboardUrl: 'x',
    })).toBe('Promotion request — Alice: Engineer II → Senior Engineer');
  });
});

describe('renderTemplate promotion-manager-decision', () => {
  it('renders notesBlock as RAW HTML (triple-brace)', () => {
    const html = renderTemplate('promotion-manager-decision', {
      recipientName: 'Alice', employeeName: 'Alice',
      currentTitle: 'A', targetTitle: 'B',
      decisionLabel: 'Approved',
      notesBlock: '<p><strong>Notes:</strong> great work</p>',
      nextStepLine: 'Forwarded to HR for final decision.',
      dashboardUrl: 'https://x.com/dashboard/employee/promotions',
    });
    expect(html).toContain('<p><strong>Notes:</strong> great work</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });
});

describe('renderTemplate promotion-final-decision', () => {
  it('renders final decision label without notes block when empty', () => {
    const html = renderTemplate('promotion-final-decision', {
      recipientName: 'Alice', employeeName: 'Alice',
      currentTitle: 'A', targetTitle: 'B',
      decisionLabel: 'Rejected',
      notesBlock: '',
      dashboardUrl: 'https://x.com/d',
    });
    expect(html).toContain('Rejected');
    expect(html).not.toContain('Notes:');
  });
});
