import mongoose, { Schema } from 'mongoose';

/**
 * One row per friendship. The pair is stored in a canonical order
 * (the smaller ObjectId hex string first) so a friendship between A
 * and B is always exactly one document, whichever side accepted.
 * A Friendship is created ONLY by the friend-request accept endpoint.
 */
const friendshipSchema = new Schema({
  userA: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userB: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  since: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
}, { timestamps: true, versionKey: false });

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });

/** Canonical (smaller-first) ordering for an unordered user pair. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const Friendship = mongoose.model('Friendship', friendshipSchema);
