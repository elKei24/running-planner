import { beforeEach, describe, expect, it } from 'vitest';
import { createPlan, resetPlan, setUnits, todayDate } from '@/store/state';
import { distance, durationInput, km, loggedPace, pace, paceRange, units } from './format';

describe('format', () => {
  beforeEach(() => {
    resetPlan();
    todayDate.value = '2026-11-06';
  });

  it('formats km by default and follows the units preference', () => {
    expect(units.value).toBe('km');
    expect(km(12)).toBe('12 km');
    expect(km(12.5)).toBe('12.5 km');
    expect(distance(10, 'mi')).toBe('6.2 mi');
    expect(pace(300)).toBe('5:00 /km');
    expect(pace(300, 'mi')).toBe('8:03 /mi');
    expect(paceRange({ minSecPerKm: 300, maxSecPerKm: 330 }, 'mi')).toBe('8:03–8:51 /mi');
    createPlan({ weeklyKmRecent: 30, longestRecentRunKm: 12, daysPerWeek: 4, longRunDay: 6, peakWeeklyKm: 60 }, { date: '2027-03-14', distanceKm: 42.195 });
    setUnits('mi');
    expect(units.value).toBe('mi');
    expect(km(16.09)).toBe('10 mi');
    expect(loggedPace({ distanceKm: 10, durationSec: 3000 })).toBe('8:03 /mi');
    expect(loggedPace({ distanceKm: 10, durationSec: 3000 }, 'km')).toBe('5:00 /km');
    expect(loggedPace({ distanceKm: 10 })).toBeUndefined();
  });

  it('formats duration entry stopwatch style, digits filling in from the right', () => {
    expect(durationInput('')).toBe('');
    expect(durationInput('1')).toBe('00:00:01');
    expect(durationInput('987')).toBe('00:09:87');
    expect(durationInput('12345')).toBe('01:23:45');
    expect(durationInput('01:23:456')).toBe('12:34:56');
    expect(durationInput('1:45:00')).toBe('01:45:00');
    expect(durationInput('00:00:0')).toBe('');
    expect(durationInput('abc')).toBe('');
  });
});
