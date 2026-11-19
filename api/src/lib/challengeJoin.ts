import mongoose from 'mongoose';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { isDuplicateKeyError } from './points.js';

export type JoinParticipantDoc = {
  _id: mongoose.Types.ObjectId;
  challengeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: string;
  joinedAt: Date;
  completedAt: Date | null;
  leftAt: Date | null;
  completedDays: number;
  streak: number;
  pointsEarned: number;
};

export type JoinChallengeDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  durationDays: number;
  kind: string;
  templateId: string | null;
  rules: string[];
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Join a challenge under the Phase 3 rules: one active participation
 * per user per challenge (enforced by the partial unique index), so a
 * duplicate join is impossible. Returns `fresh: false` when the user
 * is already taking part. Used by the challenge routes AND by
 * challenge-invite acceptance, so both paths behave identically.
 */
export async function joinChallenge(
  userId: string,
  challenge: JoinChallengeDoc,
): Promise<{ participant: JoinParticipantDoc; fresh: boolean }> {
  const existing = (await ChallengeParticipant.findOne({
    userId,
    challengeId: challenge._id,
    status: 'active',
  }).lean()) as unknown as JoinParticipantDoc | null;
  if (existing) {
    return { participant: existing, fresh: false };
  }
  try {
    const participant = await ChallengeParticipant.create({
      challengeId: challenge._id,
      userId,
      status: 'active',
      joinedAt: new Date(),
    });
    return { participant: participant.toObject() as JoinParticipantDoc, fresh: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const again = (await ChallengeParticipant.findOne({
        userId,
        challengeId: challenge._id,
        status: 'active',
      }).lean()) as unknown as JoinParticipantDoc | null;
      if (again) return { participant: again, fresh: false };
    }
    throw error;
  }
}
