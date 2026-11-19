import { describe, expect, it } from 'vitest';
import { challengeCompletionPoints, POINT_VALUES } from './points.js';

describe('POINT_VALUES', () => {
  it('has no points for individual prayers (respectful/optional rule)', () => {
    expect(Object.keys(POINT_VALUES)).toEqual([
      'focus_session_completed',
      'task_completed',
      'challenge_day_completed',
      'challenge_completed',
    ]);
    expect(POINT_VALUES.focus_session_completed).toBe(10);
    expect(POINT_VALUES.task_completed).toBe(5);
    expect(POINT_VALUES.challenge_day_completed).toBe(10);
  });
});

describe('challengeCompletionPoints', () => {
  it('awards the duration-based completion bonus', () => {
    expect(challengeCompletionPoints(365)).toBe(365);
    expect(challengeCompletionPoints(400)).toBe(365);
    expect(challengeCompletionPoints(30)).toBe(100);
    expect(challengeCompletionPoints(90)).toBe(100);
    expect(challengeCompletionPoints(7)).toBe(50);
    expect(challengeCompletionPoints(1)).toBe(50);
  });
});
