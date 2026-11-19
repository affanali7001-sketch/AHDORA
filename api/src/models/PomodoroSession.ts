import mongoose, { Schema } from 'mongoose';

export const pomodoroModes = ['focus', 'break'] as const;
export const pomodoroStatuses = ['active', 'paused', 'completed', 'abandoned'] as const;

/**
 * A Pomodoro timer session. The server is the source of truth for resume:
 * it stores startedAt + pausedTotalMs, and the client derives the remaining
 * time as planned - (now - startedAt - pausedTotalMs - current pause).
 * A refresh, logout, or device change just re-fetches the active session.
 */
const pomodoroSessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  mode: {
    type: String,
    enum: pomodoroModes,
    required: true,
  },
  plannedMinutes: {
    type: Number,
    required: true,
    min: 1,
    max: 180,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  /** Stamped when paused; null while running. */
  pausedAt: {
    type: Date,
    default: null,
  },
  /** Total milliseconds spent paused across all pauses so far. */
  pausedTotalMs: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: pomodoroStatuses,
    default: 'active',
  },
  completedAt: {
    type: Date,
    default: null,
  },
  /** Whole minutes of focus actually earned. 0 for breaks and abandoned sessions. */
  focusMinutesEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'StudyTask',
    default: null,
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'StudySubject',
    default: null,
  },
}, { timestamps: true, versionKey: false });

pomodoroSessionSchema.index({ userId: 1, status: 1 });
pomodoroSessionSchema.index({ userId: 1, completedAt: 1 });

export const PomodoroSession = mongoose.model('PomodoroSession', pomodoroSessionSchema);
