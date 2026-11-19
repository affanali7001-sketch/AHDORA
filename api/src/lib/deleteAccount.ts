import { Challenge } from '../models/Challenge.js';
import { ChallengeInvitation } from '../models/ChallengeInvitation.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { ChallengeProgress } from '../models/ChallengeProgress.js';
import { EmailToken } from '../models/EmailToken.js';
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
import { Session } from '../models/Session.js';
import { StudySubject } from '../models/StudySubject.js';
import { StudyTask } from '../models/StudyTask.js';
import { User } from '../models/User.js';
import { UserBadge } from '../models/UserBadge.js';
import { UserPoints } from '../models/UserPoints.js';

/**
 * Full account deletion.
 *
 * Deletes the user AND every record that belongs to them, across every
 * collection. Two deliberate rules, stated here and in the UI:
 *  - Challenges the user created are deleted ONLY when nobody else
 *    takes part in them. A challenge with other active participants is
 *    a shared object, so it stays (the deleted user's participation,
 *    progress and invitations are still removed).
 *  - The user's own participations, progress rows and invitations are
 *    always deleted, even for challenges that survive.
 * Sessions are revoked first, so every device is signed out at once.
 * Returns per-collection delete counts for logging/reporting.
 */
export async function deleteAccount(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const del = async (name: string, promise: Promise<{ deletedCount?: number }>) => {
    counts[name] = (await promise).deletedCount ?? 0;
  };

  // Sessions first: every device is signed out immediately.
  await del('sessions', Session.deleteMany({ userId }));
  await del('emailTokens', EmailToken.deleteMany({ userId }));

  // Identity + onboarding.
  await del('profile', Profile.deleteMany({ userId }));

  // Salah + prayer.
  await del('salahDays', SalahDay.deleteMany({ userId }));

  // Study.
  await del('studySubjects', StudySubject.deleteMany({ userId }));
  await del('studyTasks', StudyTask.deleteMany({ userId }));
  await del('pomodoroSessions', PomodoroSession.deleteMany({ userId }));

  // Challenges: own participations/progress/invitations first.
  await del('challengeProgress', ChallengeProgress.deleteMany({ userId }));
  await del('challengeParticipants', ChallengeParticipant.deleteMany({ userId }));
  await del(
    'challengeInvitations',
    ChallengeInvitation.deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] }),
  );
  // Challenges created by this user: delete only when nobody else
  // takes part; shared challenges survive without the deleted user.
  let deletedChallenges = 0;
  const created = await Challenge.find({ createdBy: userId }).select('_id').lean();
  for (const challenge of created) {
    const others = await ChallengeParticipant.countDocuments({
      challengeId: challenge._id,
      userId: { $ne: userId },
    });
    if (others === 0) {
      await Challenge.deleteOne({ _id: challenge._id });
      deletedChallenges += 1;
    }
  }
  counts.challenges = deletedChallenges;

  // Friends.
  await del('friendships', Friendship.deleteMany({ $or: [{ userA: userId }, { userB: userId }] }));
  await del('friendRequests', FriendRequest.deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] }));

  // Rewards.
  await del('userPoints', UserPoints.deleteMany({ userId }));
  await del('pointTransactions', PointTransaction.deleteMany({ userId }));
  await del('userBadges', UserBadge.deleteMany({ userId }));

  // Notifications.
  await del('notifications', Notification.deleteMany({ userId }));
  await del('notificationSettings', NotificationSetting.deleteMany({ userId }));

  // Quran.
  await del('quranBookmarks', QuranBookmark.deleteMany({ userId }));
  await del('quranReading', QuranReading.deleteMany({ userId }));

  // The user row itself, last.
  await del('users', User.deleteOne({ _id: userId }));

  return counts;
}
