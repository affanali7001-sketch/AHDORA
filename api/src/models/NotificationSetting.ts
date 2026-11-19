import mongoose, { Schema } from 'mongoose';

const categorySchema = new Schema({
  prayer: { type: Boolean, default: true },
  study: { type: Boolean, default: true },
  sleep: { type: Boolean, default: true },
  challenge: { type: Boolean, default: true },
  friend: { type: Boolean, default: true },
  system: { type: Boolean, default: true },
}, { _id: false });

/**
 * Per-user notification preferences. Categories the user switches off
 * never create a notification. Quiet hours (HH:mm, profile timezone)
 * do NOT delete anything: notifications created during quiet hours are
 * still stored, they are just not pushed live over the socket until
 * the user opens the app and reads them.
 */
const notificationSettingSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  categories: {
    type: categorySchema,
    default: () => ({}),
  },
  quietHoursStart: {
    type: String,
    trim: true,
    maxlength: 5,
    default: '',
  },
  quietHoursEnd: {
    type: String,
    trim: true,
    maxlength: 5,
    default: '',
  },
}, { timestamps: true, versionKey: false });

export const NotificationSetting = mongoose.model(
  'NotificationSetting',
  notificationSettingSchema,
);
