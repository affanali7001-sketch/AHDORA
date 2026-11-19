import mongoose, { Schema } from 'mongoose';

export const progressSources = [
  'salah',
  'study-task',
  'focus-session',
  'self-reported',
] as const;

/**
 * One completed day inside one participation. A day is only ever marked
 * completed from real activity (or, for sleep/Quran/discipline, from an
 * honest self-reported check-in that is labelled as such everywhere it
 * is shown). A completed day is sticky: undoing the underlying activity
 * later the same day does not un-complete it, and points are never
 * clawed back.
 */
const challengeProgressSchema = new Schema({
  participantId: {
    type: Schema.Types.ObjectId,
    ref: 'ChallengeParticipant',
    required: true,
    index: true,
  },
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
  /** YYYY-MM-DD in the user's own timezone. */
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  /** 1-based day inside the challenge (1 = the day the user joined). */
  dayNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  completed: {
    type: Boolean,
    default: true,
  },
  source: {
    type: String,
    enum: progressSources,
    required: true,
  },
  /** Ids of the real records that completed this day, for audit. */
  evidenceRefs: {
    type: [String],
    default: [],
  },
}, { timestamps: true, versionKey: false });

challengeProgressSchema.index({ participantId: 1, date: 1 }, { unique: true });
challengeProgressSchema.index({ userId: 1, date: 1 });

export const ChallengeProgress = mongoose.model(
  'ChallengeProgress',
  challengeProgressSchema,
);
