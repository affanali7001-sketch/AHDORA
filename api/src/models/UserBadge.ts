import mongoose, { Schema } from 'mongoose';

/** A badge a user has earned. Awarded server-side only; one per user. */
const userBadgeSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  badgeId: {
    type: String,
    required: true,
    maxlength: 60,
  },
  awardedAt: {
    type: Date,
    default: () => new Date(),
  },
}, { timestamps: true, versionKey: false });

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export const UserBadge = mongoose.model('UserBadge', userBadgeSchema);
