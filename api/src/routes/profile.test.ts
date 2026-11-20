import { describe, expect, it } from 'vitest';
import {
  applyOnboardingTransitions,
  onboardingStatus,
  profileSchema,
} from './profile.js';

/**
 * Onboarding skip/return tests (pure — no DB).
 *
 * The save itself is a Mongoose upsert, which this suite does not
 * open a database for (see vitest.config.ts). What is verified
 * here: the status the API reports for each saved state, the
 * transitions that keep skipped/completed consistent, and the
 * validation of the new skip fields. The full save-then-GET round
 * trip is covered by the manual curl steps in the handover report.
 */
describe('onboardingStatus', () => {
  it('reports not-started when there is no profile yet', () => {
    expect(onboardingStatus(null)).toEqual({
      status: 'not-started',
      step: 0,
      completed: false,
      skipped: false,
    });
  });

  it('reports in-progress from a saved step', () => {
    expect(onboardingStatus({ onboardingStep: 3 })).toEqual({
      status: 'in-progress',
      step: 3,
      completed: false,
      skipped: false,
    });
  });

  it('reports skipped and keeps the resume step', () => {
    expect(onboardingStatus({ onboardingSkipped: true, onboardingStep: 2 })).toEqual({
      status: 'skipped',
      step: 2,
      completed: false,
      skipped: true,
    });
  });

  it('completion wins over a stale skip and pins step 8', () => {
    expect(onboardingStatus({ onboardingCompleted: true, onboardingSkipped: true })).toEqual({
      status: 'completed',
      step: 8,
      completed: true,
      skipped: false,
    });
  });

  it('clamps an out-of-range saved step', () => {
    expect(onboardingStatus({ onboardingStep: 99 }).step).toBe(8);
    expect(onboardingStatus({ onboardingStep: -1 }).status).toBe('not-started');
  });
});

describe('applyOnboardingTransitions', () => {
  it('completing clears a skip and pins step 8', () => {
    expect(
      applyOnboardingTransitions({ onboardingCompleted: true, onboardingSkipped: true, onboardingStep: 3 }),
    ).toEqual({ onboardingCompleted: true, onboardingSkipped: false, onboardingStep: 8 });
  });

  it('skipping keeps the step and marks incomplete', () => {
    expect(
      applyOnboardingTransitions({ onboardingSkipped: true, onboardingStep: 2 }),
    ).toEqual({ onboardingSkipped: true, onboardingStep: 2, onboardingCompleted: false });
  });

  it('saving any field after a skip clears the skip', () => {
    // A field save carries no skip flag: the user is back in the
    // form, so a previous skip (stored in the DB) no longer applies.
    expect(applyOnboardingTransitions({ city: 'Mumbai' })).toMatchObject({
      city: 'Mumbai',
      onboardingSkipped: false,
    });
  });
});

describe('profileSchema onboarding fields', () => {
  it('accepts a skip save and a partial step save', () => {
    expect(profileSchema.safeParse({ onboardingSkipped: true, onboardingStep: 2 }).success).toBe(true);
    expect(profileSchema.safeParse({ city: 'Mumbai', onboardingStep: 4 }).success).toBe(true);
    expect(profileSchema.safeParse({ onboardingCompleted: true }).success).toBe(true);
  });

  it('rejects an out-of-range step', () => {
    expect(profileSchema.safeParse({ onboardingStep: 9 }).success).toBe(false);
    expect(profileSchema.safeParse({ onboardingStep: -1 }).success).toBe(false);
    expect(profileSchema.safeParse({ onboardingStep: 2.5 }).success).toBe(false);
  });
});
