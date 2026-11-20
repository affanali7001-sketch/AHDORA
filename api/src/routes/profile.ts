import { Router } from 'express';
import { z } from 'zod';
import { Profile } from '../models/Profile.js';

export const profileRouter = Router();

const prayerSettingSchema = z.object({
  timeOverride: z.string().max(5).optional(),
  endTime: z.string().max(5).optional(),
  reminder: z.boolean().optional(),
});

const profileSchema = z.object({
  dateOfBirth: z.string().trim().max(10).optional(),
  gender: z.enum(['', 'female', 'male', 'prefer-not-to-say']).optional(),
  profilePictureUrl: z.string().trim().max(500).optional(),
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
  weekendSchedule: z.string().trim().max(200).optional(),
  scheduleNote: z.string().trim().max(500).optional(),

  studyStartTime: z.string().max(10).optional(),
  studyEndTime: z.string().max(10).optional(),
  dailyStudyTarget: z.string().trim().max(20).optional(),
  dailyStudyHours: z.string().trim().max(10).optional(),
  studyBreakMinutes: z.string().trim().max(10).optional(),
  subjectTargets: z.string().trim().max(500).optional(),
  preferredStudyDays: z.array(z.string().trim().min(1).max(12)).max(7).optional(),

  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(60).optional(),
  locationPermission: z.boolean().optional(),

  prayerCalculationMethod: z.string().trim().max(60).optional(),

  asrMethod: z.enum(['', 'standard', 'hanafi']).optional(),

  prayerSettings: z.object({
    Fajr: prayerSettingSchema.optional(),
    Dhuhr: prayerSettingSchema.optional(),
    Asr: prayerSettingSchema.optional(),
    Maghrib: prayerSettingSchema.optional(),
    Isha: prayerSettingSchema.optional(),
  }).partial().optional(),

  sleepTime: z.string().max(10).optional(),
  sleepStartTime: z.string().max(10).optional(),
  sleepEndTime: z.string().max(10).optional(),
  sleepReminder: z.boolean().optional(),
  focusStartTime: z.string().max(10).optional(),
  focusEndTime: z.string().max(10).optional(),

  hijriDayOffset: z.number().int().min(-2).max(2).optional(),
  quranDailyTarget: z.number().int().min(0).max(500).optional(),

  onboardingCompleted: z.boolean().optional(),
  // Skip / return-to-complete (audit items 4 + 9). A user may save
  // nothing yet and come back later: onboardingSkipped records that
  // they chose "not now", onboardingStep (0–8) records how far they
  // got so the form can resume there. Matching fields exist on the
  // Profile model (onboardingSkipped, onboardingStep), so the flag
  // persists and GET reports 'skipped' with the resume step.
  onboardingSkipped: z.boolean().optional(),
  onboardingStep: z.number().int().min(0).max(8).optional(),
}).strict();

export { profileSchema };

/** Where the user stands in onboarding, derived from the saved profile. */
export type OnboardingStatus = 'not-started' | 'in-progress' | 'skipped' | 'completed';

export function onboardingStatus(profile: unknown): {
  status: OnboardingStatus;
  step: number;
  completed: boolean;
  skipped: boolean;
} {
  const p = (profile !== null && typeof profile === 'object' ? profile : {}) as {
    onboardingCompleted?: unknown;
    onboardingSkipped?: unknown;
    onboardingStep?: unknown;
  };
  const completed = p.onboardingCompleted === true;
  const skipped = p.onboardingSkipped === true;
  const step = typeof p.onboardingStep === 'number' && Number.isInteger(p.onboardingStep)
    ? Math.min(8, Math.max(0, p.onboardingStep))
    : 0;
  if (completed) return { status: 'completed', step: 8, completed: true, skipped: false };
  if (skipped) return { status: 'skipped', step, completed: false, skipped: true };
  if (step > 0) return { status: 'in-progress', step, completed: false, skipped: false };
  return { status: 'not-started', step: 0, completed: false, skipped: false };
}

/**
 * State transitions for an onboarding save (pure, tested):
 * - completing clears any earlier skip and pins the step at 8;
 * - skipping keeps the step (resume point) and marks incomplete;
 * - any other save means the user is back in the form, so a previous
 *   skip no longer applies.
 */
export function applyOnboardingTransitions<
  T extends { onboardingCompleted?: boolean; onboardingSkipped?: boolean; onboardingStep?: number } & Record<string, unknown>,
>(data: T): T {
  const update = { ...data };
  if (update.onboardingCompleted === true) {
    update.onboardingSkipped = false;
    update.onboardingStep = 8;
    return update;
  }
  if (update.onboardingSkipped === true) {
    update.onboardingCompleted = false;
    return update;
  }
  update.onboardingSkipped = false;
  return update;
}

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

    // Partial progress is returned as saved, plus a summary so the
    // frontend can offer "complete onboarding" when it was skipped.
    res.json({ profile, onboarding: onboardingStatus(profile) });
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

    // Partial saves already work (every field is optional, upserted):
    // each onboarding step can be saved on its own, and GET returns
    // whatever is saved so far. The transitions below keep the
    // skipped/completed state consistent (see applyOnboardingTransitions).
    const update = applyOnboardingTransitions(parsed.data);

    const profile = await Profile.findOneAndUpdate(
      { userId: req.authUser.id },
      {
        $set: update,
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
      onboarding: onboardingStatus(profile),
    });
  } catch (error) {
    next(error);
  }
});