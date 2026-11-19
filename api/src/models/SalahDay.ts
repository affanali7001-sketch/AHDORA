import mongoose, { Schema } from 'mongoose';

const prayerStatusSchema = new Schema({
  status: {
    type: String,
    enum: ['pending', 'prayed', 'qaza', 'missed'],
    default: 'pending',
  },
  updatedAt: { type: Date, default: null },
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