import { beforeEach, describe, expect, it } from 'vitest';
import { createPlan, resetPlan, setUnits, todayDate } from '@/store/state';
import { distance, km, pace, paceRange, units } from './format';

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
  });
});
