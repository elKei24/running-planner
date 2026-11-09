import { describe, expect, it } from 'vitest';
import { expectedHr, formatHrRange, HR_ZONES } from './heartRate';
import type { SessionType } from './types';

describe('heartRate', () => {
  it('covers every running session type once, in ascending bands', () => {
    const covered = HR_ZONES.flatMap((z) => z.types);
    const running: SessionType[] = ['recovery', 'easy', 'long', 'marathonPace', 'tempo', 'intervals'];
    for (const t of running) expect(covered.filter((c) => c === t)).toHaveLength(1);
    for (let i = 1; i < HR_ZONES.length; i++) {
      expect(HR_ZONES[i]!.min).toBeGreaterThan(HR_ZONES[i - 1]!.min);
      expect(HR_ZONES[i]!.max).toBeGreaterThan(HR_ZONES[i - 1]!.max);
    }
    expect(HR_ZONES[HR_ZONES.length - 1]!.max).toBe(1);
  });

  it('scales the bands to the athlete and leaves rest and races without a band', () => {
    expect(expectedHr('easy', 190)).toEqual([124, 150]);
    expect(expectedHr('tempo', 190)).toEqual([167, 175]);
    expect(expectedHr('intervals', 200)).toEqual([190, 200]);
    expect(expectedHr('rest', 190)).toBeUndefined();
    expect(expectedHr('race', 190)).toBeUndefined();
    expect(expectedHr('easy', 0)).toBeUndefined();
    expect(formatHrRange([124, 150])).toBe('124–150 bpm');
  });
});
