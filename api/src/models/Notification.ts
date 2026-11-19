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
 * challenge completed, badge earned). There is no background scheduler
 * in this codebase, so no notification is ever claimed to be pushed
 * while the app is closed — see the notes in lib/notifications.ts.
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
    maxlength: 60,
    default: '',
  },
  read: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true, versionKey: false });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
