import { beforeEach, describe, expect, it } from 'vitest';
import { createPlan, excludeDay, resetPlan, schedule, state, todayDate } from './state';

describe('excludeDay', () => {
  beforeEach(() => {
    resetPlan();
    todayDate.value = '2026-11-06';
    createPlan({ weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6, peakWeeklyKm: 70 }, { date: '2027-03-14', distanceKm: 42.195 });
  });

  it('creates an availability override without that weekday and re-plans the week', () => {
    const before = schedule.value!.weeks[1]!;
    expect(before.sessions[2]!.distanceKm).toBeGreaterThan(0); // Wednesday is a run day
    excludeDay('2026-11-11'); // Wednesday of week 2
    expect(state.value!.events).toEqual([{ id: expect.any(String), kind: 'availability', weekOf: '2026-11-09', days: [0, 1, 3, 4, 5, 6] }]);
    const after = schedule.value!.weeks[1]!;
    expect(after.sessions[2]!.distanceKm).toBe(0);
    expect(after.sessions.filter((s) => s.distanceKm > 0)).toHaveLength(5);
  });

  it('extends an existing override for the same week', () => {
    excludeDay('2026-11-11');
    excludeDay('2026-11-13');
    const overrides = state.value!.events.filter((e) => e.kind === 'availability');
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({ weekOf: '2026-11-09', days: [0, 1, 3, 5, 6] });
  });
});
