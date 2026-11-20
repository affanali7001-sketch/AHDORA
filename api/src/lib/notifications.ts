import { Notification, type NotificationType } from '../models/Notification.js';
import { NotificationSetting } from '../models/NotificationSetting.js';
import { emitToUser } from './realtime.js';
import { nowMinutesInTimezone, toMinutes } from './timezone.js';
import { userTimezone } from './challengeProgress.js';

/**
 * In-app notifications — created server-side, only for real events.
 *
 * Two rules are enforced here and nowhere else:
 * 1. A category the user switched off never creates a notification.
 * 2. Quiet hours (in the user's profile timezone) never delete
 *    anything: the notification is still stored, it is just NOT pushed
 *    live over the socket. The user sees it when they open the app.
 *
 * Time-based reminders are delivered by the in-process scheduler
 * (lib/scheduler.ts, one tick per minute, in-app + Socket.IO only —
 * there is no web push). The scheduler creates each event at most
 * once via createScheduledNotification, which dedupes on
 * (userId, type, refId) — scheduler refIds always include the date
 * and event, e.g. `prayer:Fajr:start:2026-11-20`.
 *
 * All copy lives in lib/notificationCopy.ts and is Hinglish.
 */

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  refType?: string;
  refId?: string;
};

export type CreatedNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  refType: string;
  refId: string;
  read: boolean;
  createdAt: Date;
};

/** Is `now` inside the user's quiet-hours window? Handles overnight windows. */
export function isInQuietHours(
  nowMinutes: number | null,
  start: string,
  end: string,
): boolean {
  if (nowMinutes === null) return false;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null || startMin === endMin) return false;
  if (startMin < endMin) return nowMinutes >= startMin && nowMinutes < endMin;
  return nowMinutes >= startMin || nowMinutes < endMin;
}

export async function getNotificationSettings(userId: string) {
  const existing = await NotificationSetting.findOne({ userId }).lean();
  if (existing) return existing;
  try {
    const created = await NotificationSetting.create({ userId });
    return created.toObject();
  } catch {
    // A concurrent first read may have created it already.
    const again = await NotificationSetting.findOne({ userId }).lean();
    if (!again) throw new Error('Notification settings could not be loaded');
    return again;
  }
}

/**
 * Create a notification for a real event and, unless the user is in
 * quiet hours, push it live to their socket room. Returns null when
 * the category is switched off (nothing is stored). Never throws —
 * notifications must never break the request that triggered them.
 */
export async function createNotification(
  userId: string,
  input: NotificationInput,
): Promise<CreatedNotification | null> {
  try {
    const settings = await getNotificationSettings(userId);
    if (settings.categories?.[input.type] === false) return null;

    const doc = await Notification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      refType: input.refType ?? '',
      refId: input.refId ?? '',
      read: false,
    });
    const created: CreatedNotification = {
      id: String(doc._id),
      type: input.type,
      title: input.title,
      body: input.body,
      refType: input.refType ?? '',
      refId: input.refId ?? '',
      read: false,
      createdAt: doc.createdAt,
    };

    // Quiet hours: stored, not pushed live.
    const timezone = await userTimezone(userId);
    const nowMin = nowMinutesInTimezone(timezone);
    const quiet = isInQuietHours(
      nowMin,
      settings.quietHoursStart ?? '',
      settings.quietHoursEnd ?? '',
    );
    if (!quiet) {
      emitToUser(userId, 'notification_created', { notification: created });
    }
    return created;
  } catch {
    return null;
  }
}

/**
 * Scheduler entry point: create a notification at most ONCE per
 * (userId, type, refId). The scheduler's refIds always name the exact
 * event and day (e.g. `prayer:Fajr:start:2026-11-20`), so a tick that
 * runs twice, or a server restart mid-day, can never double-notify.
 *
 * Returns the created notification, or null when it already exists,
 * when the category is switched off, or on any error. The category
 * and quiet-hours rules of createNotification still apply.
 */
export async function createScheduledNotification(
  userId: string,
  input: NotificationInput,
): Promise<CreatedNotification | null> {
  try {
    if (!input.refId) return null;
    const exists = await Notification.exists({
      userId,
      type: input.type,
      refId: input.refId,
    });
    if (exists) return null;
    return await createNotification(userId, input);
  } catch {
    return null;
  }
}
