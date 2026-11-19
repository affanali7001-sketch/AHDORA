import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { SalahDay } from '../models/SalahDay.js';

export const salahRouter = Router();

salahRouter.use(requireAuth);

const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
const statusSchema = z.enum(['pending', 'prayed', 'qaza', 'missed']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

salahRouter.get('/day/:date', async (req, res, next) => {
  try {
    const parsedDate = dateSchema.safeParse(req.params.date);

    if (!parsedDate.success) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }

    const record = await SalahDay.findOne({
      userId: req.authUser!.id,
      date: parsedDate.data,
    }).lean();

    res.json({
      date: parsedDate.data,
      prayers: record?.prayers ?? Object.fromEntries(
        prayers.map(name => [name, { status: 'pending', updatedAt: null }]),
      ),
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

    // A user cannot write records for a future date.
    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (parsedDate.data > todayKey) {
      res.status(400).json({ error: 'Future dates cannot be updated' });
      return;
    }

    const field = `prayers.${parsedBody.data.prayer}`;

    const record = await SalahDay.findOneAndUpdate(
      { userId: req.authUser!.id, date: parsedDate.data },
      {
        $set: {
          [field]: {
            status: parsedBody.data.status,
            updatedAt: new Date(),
          },
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({ date: parsedDate.data, prayers: record?.prayers });
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

    const records = await SalahDay.find({
      userId: req.authUser!.id,
      date: { $regex: `^${req.params.month}-` },
    }).select('date prayers').lean();

    const totals = { prayed: 0, qaza: 0, missed: 0, pending: 0 };

    for (const day of records) {
      for (const prayer of prayers) {
        const status = day.prayers?.[prayer]?.status ?? 'pending';
        totals[status as keyof typeof totals]++;
      }
    }

    res.json({
      month: req.params.month,
      days: records.map(day => ({ date: day.date, prayers: day.prayers })),
      totals,
    });
  } catch (error) {
    next(error);
  }
});