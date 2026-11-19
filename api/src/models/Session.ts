import mongoose, { Schema } from 'mongoose';

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, expires: 0 },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

export const Session = mongoose.model('Session', sessionSchema);
