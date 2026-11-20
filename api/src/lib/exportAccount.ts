import { Challenge } from '../models/Challenge.js';
import { ChallengeInvitation } from '../models/ChallengeInvitation.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { ChallengeProgress } from '../models/ChallengeProgress.js';
import { Feedback } from '../models/Feedback.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { Friendship } from '../models/Friendship.js';
import { Notification } from '../models/Notification.js';
import { NotificationSetting } from '../models/NotificationSetting.js';
import { PointTransaction } from '../models/PointTransaction.js';
import { PomodoroSession } from '../models/PomodoroSession.js';
import { Profile } from '../models/Profile.js';
import { QuranBookmark } from '../models/QuranBookmark.js';
import { QuranReading } from '../models/QuranReading.js';
import { SalahDay } from '../models/SalahDay.js';
import { StudySubject } from '../models/StudySubject.js';
import { StudyTask } from '../models/StudyTask.js';
import { User } from '../models/User.js';
import { UserBadge } from '../models/UserBadge.js';
import { UserPoints } from '../models/UserPoints.js';

/**
 * Personal data export (GDPR-style, own data only).
 *
 * Returns the user's own records as plain JSON. Secrets are never
 * included: no password hash, no session tokens, no email-token
 * hashes. Shared objects (e.g. a challenge with other participants)
 * are exported as the user's own participation/progress rows only.
 */
export async function exportAccount(userId: string): Promise<Record<string, unknown>> {
  const clean = (rows: unknown[]) => rows;
  const user = await User.findById(userId).select('_id name email emailVerifiedAt role createdAt updatedAt').lean();
  return {
    exportedAt: new Date().toISOString(),
    user,
    profile: await Profile.findOne({ userId }).lean(),
    salahDays: clean(await SalahDay.find({ userId }).lean()),
    studySubjects: clean(await StudySubject.find({ userId }).lean()),
    studyTasks: clean(await StudyTask.find({ userId }).lean()),
    pomodoroSessions: clean(await PomodoroSession.find({ userId }).lean()),
    challengesCreated: clean(await Challenge.find({ createdBy: userId }).lean()),
    challengeParticipants: clean(await ChallengeParticipant.find({ userId }).lean()),
    challengeProgress: clean(await ChallengeProgress.find({ userId }).lean()),
    challengeInvitations: clean(
      await ChallengeInvitation.find({ $or: [{ fromUserId: userId }, { toUserId: userId }] }).lean(),
    ),
    friendships: clean(
      await Friendship.find({ $or: [{ userA: userId }, { userB: userId }] }).lean(),
    ),
    friendRequests: clean(
      await FriendRequest.find({ $or: [{ fromUserId: userId }, { toUserId: userId }] }).lean(),
    ),
    userPoints: await UserPoints.findOne({ userId }).lean(),
    pointTransactions: clean(await PointTransaction.find({ userId }).lean()),
    userBadges: clean(await UserBadge.find({ userId }).lean()),
    notifications: clean(await Notification.find({ userId }).sort({ createdAt: -1 }).limit(500).lean()),
    notificationSettings: await NotificationSetting.findOne({ userId }).lean(),
    quranBookmarks: clean(await QuranBookmark.find({ userId }).lean()),
    quranReading: clean(await QuranReading.find({ userId }).lean()),
    feedback: clean(await Feedback.find({ userId }).sort({ createdAt: -1 }).lean()),
  };
}
