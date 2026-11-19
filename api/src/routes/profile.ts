import { Router } from 'express';
import { z } from 'zod';
import { Profile } from '../models/Profile.js';

export const profileRouter = Router();

const profileSchema = z.object({
  education: z.string().trim().max(80).optional(),
  course: z.string().trim().max(100).optional(),
  collegeName: z.string().trim().max(140).optional(),
  classYear: z.string().trim().max(40).optional(),
  branch: z.string().trim().max(100).optional(),
  semester: z.string().trim().max(40).optional(),

  subjects: z.array(
    z.string().trim().min(1).max(80)
  ).max(30).optional(),

  collegeStartTime: z.string().max(10).optional(),
  collegeEndTime: z.string().max(10).optional(),
  collegeDays: z.array(z.string().trim().min(1).max(12)).max(7).optional(),
  weeklyOffDays: z.array(z.string().trim().min(1).max(12)).max(7).optional(),

  studyStartTime: z.string().max(10).optional(),
  studyEndTime: z.string().max(10).optional(),
  dailyStudyTarget: z.string().trim().max(20).optional(),
  preferredStudyDays: z.array(z.string().trim().min(1).max(12)).max(7).optional(),

  city: z.string().trim().max(100).optional(),

  prayerCalculationMethod: z.string().trim().max(60).optional(),

  asrMethod: z.enum(['', 'standard', 'hanafi']).optional(),

  sleepTime: z.string().max(10).optional(),
  sleepStartTime: z.string().max(10).optional(),
  sleepEndTime: z.string().max(10).optional(),

  onboardingCompleted: z.boolean().optional(),
}).strict();

profileRouter.get('/', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const profile = await Profile.findOne({
      userId: req.authUser.id,
    })
      .select('-userId')
      .lean();

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parsed = profileSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid profile details',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({
        error: 'At least one profile field is required',
      });
      return;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.authUser.id },
      {
        $set: parsed.data,
        $setOnInsert: { userId: req.authUser.id },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .select('-userId')
      .lean();

    res.json({
      message: 'Profile saved successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
});