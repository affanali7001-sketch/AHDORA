import mongoose, { Schema } from 'mongoose';

export const participantStatuses = ['active', 'completed', 'left'] as const;

/**
 * One user's participation in one challenge. History is preserved:
 * leaving marks the participant 'left' (points already earned stay),
 * completing marks it 'completed'. The partial unique index allows only
 * ONE active participation per user per challenge — joining twice while
 * active is impossible, and re-joining after leaving starts a fresh
 * attempt while the old one stays in history.
 */
const challengeParticipantSchema = new Schema({
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: participantStatuses,
    default: 'active',
  },
  joinedAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
  completedAt: {
    type: Date,
    default: null,
  },
  leftAt: {
    type: Date,
    default: null,
  },
  /** Days completed so far (denormalised count of ChallengeProgress rows). */
  completedDays: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Consecutive completed days ending today (or yesterday). */
  streak: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Points earned through this participation (challenge days + completion). */
  pointsEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true, versionKey: false });

challengeParticipantSchema.index(
  { userId: 1, challengeId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
challengeParticipantSchema.index({ userId: 1, status: 1 });

export const ChallengeParticipant = mongoose.model(
  'ChallengeParticipant',
  challengeParticipantSchema,
);
