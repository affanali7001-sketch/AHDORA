import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { feedbackSchema, serializeFeedback } from './feedback.js';

/**
 * Feedback route tests (pure — no DB, no SMTP).
 *
 * The route handlers themselves need MongoDB, which this suite
 * deliberately does not open (see vitest.config.ts). What is
 * verified here: the request validation that guards the create
 * endpoint, and the serializer that shapes every response. The
 * per-user scoping (every query filters by the signed-in user's
 * id) is covered by the manual curl steps in the handover report.
 */
describe('feedbackSchema', () => {
  it('accepts feedback and complaint payloads', () => {
    expect(feedbackSchema.safeParse({
      type: 'feedback',
      subject: 'Namaz reminder achha hai',
      message: 'Mujhe Fajr ka reminder bahut pasand aaya.',
    }).success).toBe(true);
    expect(feedbackSchema.safeParse({
      type: 'complaint',
      subject: 'Notification dismiss nahi hoti',
      message: 'Notification hatane ka option nahi mil raha.',
    }).success).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(feedbackSchema.safeParse({
      type: 'bug-report',
      subject: 'Something broke',
      message: 'Details here.',
    }).success).toBe(false);
  });

  it('rejects missing or too-short subject/message', () => {
    expect(feedbackSchema.safeParse({ type: 'feedback', subject: 'Hi', message: 'Details here.' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ type: 'feedback', subject: 'Good subject', message: 'No' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ type: 'feedback', subject: 'Good subject' }).success).toBe(false);
  });

  it('rejects over-long subject/message and extra fields', () => {
    expect(feedbackSchema.safeParse({
      type: 'feedback',
      subject: 'x'.repeat(141),
      message: 'Details here.',
    }).success).toBe(false);
    expect(feedbackSchema.safeParse({
      type: 'feedback',
      subject: 'Good subject',
      message: 'x'.repeat(2001),
    }).success).toBe(false);
    // .strict(): a client must not smuggle in a status — new rows
    // are always 'open' and only support may change that.
    expect(feedbackSchema.safeParse({
      type: 'feedback',
      subject: 'Good subject',
      message: 'Details here.',
      status: 'resolved',
    }).success).toBe(false);
  });
});

describe('serializeFeedback', () => {
  it('exposes id (not _id) and never exposes userId', () => {
    const id = new mongoose.Types.ObjectId();
    const out = serializeFeedback({
      _id: id,
      type: 'complaint',
      subject: 'Subject',
      message: 'Message',
      status: 'open',
      createdAt: new Date('2026-11-20T10:00:00.000Z'),
      updatedAt: new Date('2026-11-20T10:00:00.000Z'),
    });
    expect(out.id).toBe(String(id));
    expect(out).not.toHaveProperty('_id');
    expect(out).not.toHaveProperty('userId');
    expect(out.status).toBe('open');
  });
});
