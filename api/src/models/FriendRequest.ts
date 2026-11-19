import mongoose, { Schema } from 'mongoose';

export const friendRequestStatuses = ['pending', 'accepted', 'rejected', 'cancelled'] as const;

/**
 * A friend request is the ONLY way two users become friends. Nothing in
 * this codebase creates a Friendship except the accept endpoint, and
 * there is no migration or special case that connects accounts
 * automatically — the user's two existing accounts use this same
 * request/accept flow like everyone else.
 */
const friendRequestSchema = new Schema({
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
    enum: friendRequestStatuses,
    default: 'pending',
  },
  respondedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true, versionKey: false });

// Only one pending request may exist per ordered pair. The reverse
// direction is blocked in the route (accept the pending request
// instead of sending a new one).
friendRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
