import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getNotificationSettings } from '../lib/notifications.js';
import { Notification, notificationTypes } from '../models/Notification.js';
import { NotificationSetting } from '../models/NotificationSetting.js';
import { toMinutes } from '../lib/timezone.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

type NotificationDoc = {
  _id: mongoose.Types.ObjectId;
  type: string;
  title: string;
  body: string;
  refType: string;
  refId: string;
  read: boolean;
  createdAt: Date;
};

export function serializeNotification(doc: NotificationDoc) {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    refType: doc.refType,
    refId: doc.refId,
    read: doc.read,
    createdAt: doc.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* List (unread first, newest first) + unread count                    */
/* ------------------------------------------------------------------ */

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const filter = { userId: req.authUser!.id };
    const total = await Notification.countDocuments(filter);
    const unread = await Notification.countDocuments({ ...filter, read: false });
    const rows = (await Notification.find(filter)
      .sort({ read: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()) as unknown as NotificationDoc[];
    res.json({
      notifications: rows.map(serializeNotification),
      page,
      limit,
      total,
      unread,
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const unread = await Notification.countDocuments({
      userId: req.authUser!.id,
      read: false,
    });
    res.json({ unread });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Mark read                                                           */
/* ------------------------------------------------------------------ */

notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }
    const row = (await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.authUser!.id },
      { read: true },
      { new: true },
    ).lean()) as unknown as NotificationDoc | null;
    if (!row) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ notification: serializeNotification(row) });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.authUser!.id, read: false },
      { read: true },
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Delete (dismiss) — one, or clear all. Per-user only: the filter    */
/* always includes the signed-in user's id, so a user can only ever   */
/* delete their own notifications.                                    */
/* ------------------------------------------------------------------ */

notificationsRouter.delete('/', async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ userId: req.authUser!.id });
    res.json({ deleted: result.deletedCount ?? 0, message: 'All notifications deleted' });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.authUser!.id,
    });
    if (!deleted) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({
  categories: z.object({
    prayer: z.boolean(),
    study: z.boolean(),
    sleep: z.boolean(),
    challenge: z.boolean(),
    friend: z.boolean(),
    system: z.boolean(),
  }).partial().optional(),
  quietHoursStart: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')]).optional(),
  quietHoursEnd: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')]).optional(),
}).strict();

notificationsRouter.get('/settings', async (req, res, next) => {
  try {
    const settings = await getNotificationSettings(req.authUser!.id);
    res.json({
      settings: {
        categories: settings.categories ?? {
          prayer: true,
          study: true,
          sleep: true,
          challenge: true,
          friend: true,
          system: true,
        },
        quietHoursStart: settings.quietHoursStart ?? '',
        quietHoursEnd: settings.quietHoursEnd ?? '',
      },
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.put('/settings', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid notification settings' });
      return;
    }
    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.categories) {
      for (const type of notificationTypes) {
        if (typeof data.categories[type] === 'boolean') {
          update[`categories.${type}`] = data.categories[type];
        }
      }
    }
    if (typeof data.quietHoursStart === 'string') {
      update.quietHoursStart = data.quietHoursStart;
    }
    if (typeof data.quietHoursEnd === 'string') {
      update.quietHoursEnd = data.quietHoursEnd;
    }
    // Quiet hours are only meaningful as a pair; a lone value is
    // rejected so a half-set window can never silently apply.
    const start = typeof data.quietHoursStart === 'string' ? data.quietHoursStart : null;
    const end = typeof data.quietHoursEnd === 'string' ? data.quietHoursEnd : null;
    if ((start === null) !== (end === null)) {
      res.status(400).json({ error: 'Quiet hours need both a start and an end time' });
      return;
    }
    if (start && end && toMinutes(start) === toMinutes(end)) {
      res.status(400).json({ error: 'Quiet hours start and end must be different' });
      return;
    }    const settings = await NotificationSetting.findOneAndUpdate(
      { userId: req.authUser!.id },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      settings: {
        categories: settings?.categories ?? {},
        quietHoursStart: settings?.quietHoursStart ?? '',
        quietHoursEnd: settings?.quietHoursEnd ?? '',
      },
    });
  } catch (error) {
    next(error);
  }
});
