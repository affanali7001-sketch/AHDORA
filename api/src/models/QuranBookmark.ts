import mongoose, { Schema } from 'mongoose';

/**
 * A per-user Quran bookmark. The bookmark itself is user data; the
 * Quranic text it points at is never stored here — it is always
 * fetched live from the verified upstream (AlQuran Cloud, Tanzil
 * Uthmani text) when the user opens the surah.
 */
const quranBookmarkSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    surahNumber: { type: Number, required: true, min: 1, max: 114 },
    ayahNumber: { type: Number, required: true, min: 1, max: 300 },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);

// One bookmark per ayah per user — re-bookmarking the same ayah is a no-op.
quranBookmarkSchema.index({ userId: 1, surahNumber: 1, ayahNumber: 1 }, { unique: true });

export const QuranBookmark = mongoose.model('QuranBookmark', quranBookmarkSchema);
