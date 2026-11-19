import mongoose, { Schema } from 'mongoose';

export const challengeInvitationStatuses = ['pending', 'accepted', 'declined'] as const;

/**
 * An invitation for a FRIEND to join one of my challenges. History is
 * preserved: declining (or accepting) only changes the status, the row
 * stays. Only one pending invitation may exist per challenge + invited
 * user.
 */
const challengeInvitationSchema = new Schema({
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true,
  },
  fromUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  toUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: challengeInvitationStatuses,
    default: 'pending',
  },
  respondedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true, versionKey: false });

challengeInvitationSchema.index(
  { challengeId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const ChallengeInvitation = mongoose.model(
  'ChallengeInvitation',
  challengeInvitationSchema,
);
