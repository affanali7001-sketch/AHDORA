import mongoose, { Schema } from 'mongoose';

export const notificationTypes = [
  'prayer',
  'study',
  'sleep',
  'challenge',
  'friend',
  'system',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

/**
 * In-app notifications. They are created server-side, only when a real
 * event happens (friend request, invite, challenge day completed,
 * challenge completed, badge earned) or when a real time-based event
 * falls due (prayer time, task due, bedtime — see lib/scheduler.ts,
 * which dedupes on (userId, type, refId)). There is no web push:
 * delivery is in-app + Socket.IO while the app/server is running.
 */
const notificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: notificationTypes,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  refType: {
    type: String,
    trim: true,
    maxlength: 60,
    default: '',
  },
  refId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  read: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true, versionKey: false });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Scheduler dedupe: one notification per (user, type, event refId).
notificationSchema.index({ userId: 1, type: 1, refId: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
