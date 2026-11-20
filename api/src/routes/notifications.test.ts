import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { serializeNotification } from './notifications.js';

/**
 * Notification serializer test (pure — no DB).
 *
 * The delete/dismiss handlers need MongoDB, which this suite does
 * not open (see vitest.config.ts); their per-user scoping (every
 * delete filters by the signed-in user's id) is covered by the
 * manual curl steps in the handover report. What is verified here
 * is the response shape shared by list/read/delete flows.
 */
describe('serializeNotification', () => {
  it('exposes id (not _id) and never exposes userId', () => {
    const id = new mongoose.Types.ObjectId();
    const out = serializeNotification({
      _id: id,
      type: 'prayer',
      title: 'Fajr ka waqt',
      body: 'Fajr ka waqt ho gaya hai.',
      refType: 'prayer',
      refId: 'prayer:Fajr:2026-11-20',
      read: false,
      createdAt: new Date('2026-11-20T05:00:00.000Z'),
    });
    expect(out.id).toBe(String(id));
    expect(out).not.toHaveProperty('_id');
    expect(out).not.toHaveProperty('userId');
    expect(out.type).toBe('prayer');
    expect(out.read).toBe(false);
  });
});
