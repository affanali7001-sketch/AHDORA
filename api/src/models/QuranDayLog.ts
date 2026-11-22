import mongoose, { Schema } from 'mongoose';

/**
 * Per-day Quran log: one row per (user, day) holding how many ayahs
 * were read that day and whether the user listened (and for how long).
 * Days with no row mean "not read / not listened" — the daily-log
 * endpoint fills those in as zeros/false so the client can show the
 * gap honestly instead of hiding it.
 */
const quranDayLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // YYYY-MM-DD in the user's own timezone.
    dayKey: { type: String, required: true, maxlength: 10 },
    ayahsRead: { type: Number, required: true, min: 0, default: 0 },
    listened: { type: Boolean, required: true, default: false },
    listenedMinutes: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

quranDayLogSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

export const QuranDayLog = mongoose.model('QuranDayLog', quranDayLogSchema);
