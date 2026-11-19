import mongoose, { Schema } from 'mongoose';

export const taskPriorities = ['Low', 'Medium', 'High'] as const;
export const taskStatuses = ['Pending', 'In Progress', 'Completed'] as const;

const studyTaskSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    trim: true,
    required: true,
    maxlength: 140,
  },
  /** Null when the task has no subject, including after its subject is deleted. */
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'StudySubject',
    default: null,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  priority: {
    type: String,
    enum: taskPriorities,
    default: 'Medium',
  },
  /** YYYY-MM-DD the task is due. Null = unscheduled. */
  dueDate: {
    type: String,
    default: null,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  /** Planned start time HH:mm. Null = no start time set. */
  startTime: {
    type: String,
    default: null,
    match: /^([01]\d|2[0-3]):[0-5]\d$/,
  },
  durationMinutes: {
    type: Number,
    min: 1,
    max: 480,
    default: null,
  },
  status: {
    type: String,
    enum: taskStatuses,
    default: 'Pending',
  },
  /** Stamped when the task first reaches Completed; cleared if reopened. */
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true, versionKey: false });

studyTaskSchema.index({ userId: 1, dueDate: 1, startTime: 1 });
studyTaskSchema.index({ userId: 1, completedAt: 1 });

export const StudyTask = mongoose.model('StudyTask', studyTaskSchema);
