import mongoose, { Schema } from 'mongoose';

export const feedbackTypes = ['feedback', 'complaint'] as const;
export type FeedbackType = (typeof feedbackTypes)[number];

export const feedbackStatuses = ['open', 'in_progress', 'resolved'] as const;
export type FeedbackStatus = (typeof feedbackStatuses)[number];

/**
 * User feedback and complaints (audit item 10, backend part).
 *
 * One row per message a user sends from the app. Status is changed
 * by an admin/support process only — there is deliberately no
 * user-facing endpoint that changes it, so a user can never mark
 * their own complaint resolved. Rows belong to exactly one user
 * and are only ever listed by that user (see routes/feedback.ts).
 * Account deletion must remove these rows too (see lib/deleteAccount.ts).
 */
const feedbackSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: feedbackTypes,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: feedbackStatuses,
    default: 'open',
  },
}, { timestamps: true, versionKey: false });

feedbackSchema.index({ userId: 1, createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
