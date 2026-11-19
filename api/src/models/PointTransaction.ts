import mongoose, { Schema } from 'mongoose';

export const pointReasons = [
  'focus_session_completed',
  'task_completed',
  'challenge_day_completed',
  'challenge_completed',
] as const;

export type PointReason = (typeof pointReasons)[number];

/**
 * One points award for one real event. The unique index on
 * (userId, refType, refId, reason) is what makes every award idempotent:
 * a retry or refresh can never double-award the same event.
 */
const pointTransactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  reason: {
    type: String,
    enum: pointReasons,
    required: true,
  },
  /** What caused the award, e.g. 'PomodoroSession' / 'StudyTask'. */
  refType: {
    type: String,
    required: true,
    maxlength: 60,
  },
  /** The id of the event record that caused the award. */
  refId: {
    type: String,
    required: true,
    maxlength: 60,
  },
}, { timestamps: true, versionKey: false });

pointTransactionSchema.index(
  { userId: 1, refType: 1, refId: 1, reason: 1 },
  { unique: true },
);

export const PointTransaction = mongoose.model('PointTransaction', pointTransactionSchema);
