import { describe, expect, it } from 'vitest';
import { passwordResetEmail, sendEmail, verificationEmail } from './email.js';

/**
 * Email tests that need no network and no live SMTP server.
 *
 * This VM cannot reach api.nodemailer.com (Ethereal test accounts are
 * blocked here), so live delivery is NOT verified by these tests —
 * see DEPLOYMENT.md. What IS verified: the honest not-configured
 * path, and that the email bodies carry the right link and expiry.
 */
describe('sendEmail without SMTP', () => {
  it('reports not-configured instead of pretending to send', async () => {
    const result = await sendEmail({
      to: 'a@b.com',
      subject: 'x',
      text: 'x',
      html: '<p>x</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'not-configured' });
  });
});

describe('email bodies', () => {
  it('verification email carries the link and the 24-hour expiry', () => {
    const link = 'http://localhost:5173/?verifyToken=abc';
    const mail = verificationEmail('Affan', link);
    expect(mail.subject).toContain('Verify');
    expect(mail.text).toContain(link);
    expect(mail.text).toContain('24 hours');
    expect(mail.html).toContain(link);
  });

  it('reset email carries the link and the 1-hour expiry', () => {
    const link = 'http://localhost:5173/?resetToken=abc';
    const mail = passwordResetEmail('Affan', link);
    expect(mail.subject).toContain('Reset');
    expect(mail.text).toContain(link);
    expect(mail.text).toContain('1 hour');
    expect(mail.html).toContain(link);
  });
});
