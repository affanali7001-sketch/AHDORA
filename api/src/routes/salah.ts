import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { refreshChallengeProgress } from '../lib/challengeProgress.js';
import {
  recomputeDay,
  userTimezoneAndProfile,
} from '../lib/salahAutoMissed.js';
import { dateKeyInTimezone } from '../lib/timezone.js';
import { SalahDay } from '../models/SalahDay.js';

export const salahRouter = Router();

salahRouter.use(requireAuth);

const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof prayers)[number];
const statusSchema = z.enum(['pending', 'prayed', 'qaza', 'missed']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type PrayerEntry = {
  status: string;
  updatedAt: Date | null;
  wasMissed: boolean;
  missedAt: Date | null;
  autoMissed: boolean;
};

function emptyPrayers(): Record<PrayerName, PrayerEntry> {
  return Object.fromEntries(
    prayers.map((name) => [
      name,
      { status: 'pending', updatedAt: null, wasMissed: false, missedAt: null, autoMissed: false },
    ]),
  ) as Record<PrayerName, PrayerEntry>;
}

function serializePrayers(
  record: {
    prayers?: Partial<Record<PrayerName, Partial<PrayerEntry>>> | null;
  } | null,
): Record<PrayerName, PrayerEntry> {
  const base = emptyPrayers();
  if (!record?.prayers) return base;
  for (const prayer of prayers) {
    const entry = record.prayers[prayer];
    if (!entry) continue;
    base[prayer] = {
      status: entry.status ?? 'pending',
      updatedAt: entry.updatedAt ?? null,
      wasMissed: entry.wasMissed ?? false,
      missedAt: entry.missedAt ?? null,
      autoMissed: entry.autoMissed ?? false,
    };
  }
  return base;
}

salahRouter.get('/day/:date', async (req, res, next) => {
  try {
    const parsedDate = dateSchema.safeParse(req.params.date);

    if (!parsedDate.success) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }

    const { timezone, profile } = await userTimezoneAndProfile(req.authUser!.id);
    // Reading a day also recomputes auto-missed for it: past dates mark
    // every still-pending prayer missed; today uses the user's own
    // per-prayer endTime overrides (the full deadlines are applied when
    // prayer times are loaded). Never assumes prayed.
    await recomputeDay(req.authUser!.id, parsedDate.data, { timezone, profile });

    const record = await SalahDay.findOne({
      userId: req.authUser!.id,
      date: parsedDate.data,
    }).lean();

    res.json({
      date: parsedDate.data,
      prayers: serializePrayers(record),
    });
  } catch (error) {
    next(error);
  }
});

salahRouter.put('/day/:date', async (req, res, next) => {
  try {
    const parsedDate = dateSchema.safeParse(req.params.date);
    const parsedBody = z.object({
      prayer: z.enum(prayers),
      status: statusSchema,
    }).strict().safeParse(req.body);

    if (!parsedDate.success || !parsedBody.success || parsedBody.data.status === 'pending') {
      res.status(400).json({ error: 'Invalid Salah update' });
      return;
    }

    // "Today" is the user's own timezone, not the server's local date.
    const { timezone, profile } = await userTimezoneAndProfile(req.authUser!.id);
    const todayKey = dateKeyInTimezone(timezone);

    // A user cannot write records for a future date.
    if (parsedDate.data > todayKey) {
      res.status(400).json({ error: 'Future dates cannot be updated' });
      return;
    }

    const prayer = parsedBody.data.prayer;
    const newStatus = parsedBody.data.status;
    const now = new Date();
    const previous = await SalahDay.findOne({
      userId: req.authUser!.id,
      date: parsedDate.data,
    }).lean();
    const prevEntry = previous?.prayers?.[prayer] as PrayerEntry | undefined;
    const wasMissedBefore = Boolean(prevEntry?.wasMissed || prevEntry?.status === 'missed');

    // Miss history is preserved across corrections: a prayer that was
    // missed and is later corrected to Qaza (or prayed) keeps wasMissed
    // and the original missedAt, so the UI can show "Qaza (was missed)".
    const nextEntry: PrayerEntry = {
      status: newStatus,
      updatedAt: now,
      wasMissed: newStatus === 'missed' ? true : wasMissedBefore,
      missedAt:
        newStatus === 'missed'
          ? (prevEntry?.missedAt ?? now)
          : (prevEntry?.missedAt ?? null),
      autoMissed:
        newStatus === 'missed'
          ? false // a manual correction is never an auto-miss
          : (prevEntry?.autoMissed ?? false),
    };

    const record = await SalahDay.findOneAndUpdate(
      { userId: req.authUser!.id, date: parsedDate.data },
      { $set: { [`prayers.${prayer}`]: nextEntry } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    // Other pending prayers of this day may now be past their deadline.
    await recomputeDay(req.authUser!.id, parsedDate.data, { timezone, profile });
    const fresh = await SalahDay.findOne({
      userId: req.authUser!.id,
      date: parsedDate.data,
    }).lean();

    // A prayer change can complete a prayer-challenge day.
    void refreshChallengeProgress(req.authUser!.id, parsedDate.data);

    res.json({
      date: parsedDate.data,
      prayers: serializePrayers(fresh ?? record),
    });
  } catch (error) {
    next(error);
  }
});

salahRouter.get('/calendar/:month', async (req, res, next) => {
  try {
    if (!/^\d{4}-\d{2}$/.test(req.params.month)) {
      res.status(400).json({ error: 'Month must be YYYY-MM' });
      return;
    }

    const { timezone, profile } = await userTimezoneAndProfile(req.authUser!.id);
    const records = await SalahDay.find({
      userId: req.authUser!.id,
      date: { $regex: `^${req.params.month}-` },
    }).select('date prayers').lean();

    // Auto-mark missed for every past day that already has a record.
    const today = dateKeyInTimezone(timezone);
    for (const day of records) {
      if (day.date < today) {
        await recomputeDay(req.authUser!.id, day.date, { timezone, profile });
      }
    }
    const freshRecords = await SalahDay.find({
      userId: req.authUser!.id,
      date: { $regex: `^${req.params.month}-` },
    }).select('date prayers').lean();

    const totals = { prayed: 0, qaza: 0, missed: 0, pending: 0, qazaWasMissed: 0 };

    for (const day of freshRecords) {
      for (const prayer of prayers) {
        const entry = day.prayers?.[prayer] as PrayerEntry | undefined;
        const status = entry?.status ?? 'pending';
        totals[status as keyof typeof totals]++;
        if (status === 'qaza' && entry?.wasMissed) totals.qazaWasMissed++;
      }
    }

    res.json({
      month: req.params.month,
      days: freshRecords.map((day) => ({ date: day.date, prayers: serializePrayers(day) })),
      totals,
    });
  } catch (error) {
    next(error);
  }
});
