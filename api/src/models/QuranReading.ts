import mongoose, { Schema } from 'mongoose';

/**
 * Reading history: one row per (user, surah) holding the last ayah
 * the user read and when. Progress is always real history — the
 * daily target is only a setting, never presented as progress.
 */
const quranReadingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    surahNumber: { type: Number, required: true, min: 1, max: 114 },
    lastAyahNumber: { type: Number, required: true, min: 1, max: 300 },
    ayahsReadToday: { type: Number, required: true, min: 0, default: 0 },
    // YYYY-MM-DD in the user's own timezone; ayahsReadToday resets
    // when this no longer matches today.
    dayKey: { type: String, required: true, maxlength: 10 },
  },
  { timestamps: true },
);

quranReadingSchema.index({ userId: 1, surahNumber: 1 }, { unique: true });
quranReadingSchema.index({ userId: 1, updatedAt: -1 });

export const QuranReading = mongoose.model('QuranReading', quranReadingSchema);
