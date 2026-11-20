import nodemailer, { type Transporter } from 'nodemailer';
import { config, isEmailConfigured } from '../config.js';

/**
 * Email delivery via SMTP (nodemailer).
 *
 * HONEST LIMIT: SMTP is optional. When it is not fully configured,
 * `sendEmail` returns `{ sent: false, reason: 'not-configured' }` and
 * the auth routes answer 503 — the app NEVER pretends an email was
 * sent. Configure SMTP_HOST/PORT/USER/PASS/FROM in api/.env to enable
 * verification and password-reset emails for real.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE === 'true',
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      // P7: signup awaits sendEmail — without timeouts a stalled SMTP
      // connection blocked signup for ~20 s. Bound it so a slow mail
      // server fails fast instead of hanging the request.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

export type SendEmailResult =
  | { sent: true; messageId: string | null }
  | { sent: false; reason: 'not-configured' | 'send-failed'; error?: string };

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendEmailResult> {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: 'not-configured' };
  try {
    const info = await transport.sendMail({
      from: config.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { sent: true, messageId: typeof info.messageId === 'string' ? info.messageId : null };
  } catch (error) {
    console.error('Email send failed:', error instanceof Error ? error.message : 'Unknown error');
    return {
      sent: false,
      reason: 'send-failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Verification email body. The link opens the app, which confirms the token. */
export function verificationEmail(name: string, link: string): { subject: string; text: string; html: string } {
  return {
    subject: 'Verify your AHDORA email',
    text: `Assalamu alaikum ${name},\n\nPlease verify your AHDORA email address by opening this link (valid for 24 hours):\n${link}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Assalamu alaikum ${name},</p><p>Please verify your AHDORA email address by opening this link (valid for 24 hours):</p><p><a href="${link}">${link}</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  };
}

/** Password-reset email body. */
export function passwordResetEmail(name: string, link: string): { subject: string; text: string; html: string } {
  return {
    subject: 'Reset your AHDORA password',
    text: `Assalamu alaikum ${name},\n\nYou asked to reset your AHDORA password. Open this link to choose a new one (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this email — your password will not change.`,
    html: `<p>Assalamu alaikum ${name},</p><p>You asked to reset your AHDORA password. Open this link to choose a new one (valid for 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, you can ignore this email — your password will not change.</p>`,
  };
}
