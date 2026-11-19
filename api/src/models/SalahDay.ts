import mongoose, { Schema } from 'mongoose';

const prayerStatusSchema = new Schema({
  status: {
    type: String,
    enum: ['pending', 'prayed', 'qaza', 'missed'],
    default: 'pending',
  },
  updatedAt: { type: Date, default: null },
  /**
   * Miss history is preserved, never erased: when a prayer is auto-marked
   * or manually marked missed and the user later corrects it to Qaza (or
   * prayed), wasMissed stays true with the original missedAt, so the
   * calendar can honestly show "Qaza (was missed)".
   */
  wasMissed: { type: Boolean, default: false },
  missedAt: { type: Date, default: null },
  /** True when the miss was applied automatically after the deadline. */
  autoMissed: { type: Boolean, default: false },
}, { _id: false });

const salahDaySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  prayers: {
    Fajr: { type: prayerStatusSchema, default: () => ({}) },
    Dhuhr: { type: prayerStatusSchema, default: () => ({}) },
    Asr: { type: prayerStatusSchema, default: () => ({}) },
    Maghrib: { type: prayerStatusSchema, default: () => ({}) },
    Isha: { type: prayerStatusSchema, default: () => ({}) },
  },
}, { timestamps: true, versionKey: false });

salahDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export const SalahDay = mongoose.model('SalahDay', salahDaySchema);