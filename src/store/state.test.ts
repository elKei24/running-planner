import { beforeEach, describe, expect, it } from 'vitest';
import { memoryStorage } from '@/test/memoryStorage';
import { createPlan, excludeDay, initStore, logRun, persistFailed, resetPlan, schedule, setAvailability, state, todayDate } from './state';

const athlete = { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6 as const, peakWeeklyKm: 70 };
const goal = { date: '2027-03-14', distanceKm: 42.195 };

describe('persistFailed', () => {
  it('is set when the storage rejects writes and cleared when writes succeed again', () => {
    const working = memoryStorage();
    const broken = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError'); } };
    resetPlan();
    initStore(broken);
    createPlan(athlete, goal);
    expect(persistFailed.value).toBe(true);
    initStore(working);
    createPlan(athlete, goal);
    expect(persistFailed.value).toBe(false);
    expect(working.data.size).toBe(1);
  });

  it('is set when there is no storage at all', () => {
    resetPlan();
    initStore(null);
    createPlan(athlete, goal);
    expect(persistFailed.value).toBe(true);
    resetPlan();
    expect(persistFailed.value).toBe(false);
    initStore(memoryStorage());
  });
});

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

  it('re-planning the current week part-way through keeps the days already behind us as logged', () => {
    logRun({ date: '2026-11-07', distanceKm: 10 });
    logRun({ date: '2026-11-08', distanceKm: 8 });
    todayDate.value = '2026-11-10'; // Tuesday
    expect(schedule.value!.weeks[0]!.sessions[0]!.distanceKm).toBe(0); // Monday is a rest day...
    logRun({ date: '2026-11-09', distanceKm: 8 }); // ...but the athlete ran.
    excludeDay('2026-11-12');
    expect(state.value!.events).toEqual([{ id: expect.any(String), kind: 'availability', weekOf: '2026-11-09', days: [0, 1, 2, 4, 5, 6], replanFrom: '2026-11-10' }]);
    const week = schedule.value!.weeks[0]!;
    expect(week.sessions[0]).toMatchObject({ type: 'easy', distanceKm: 8, title: 'Ran 8 km' });
    expect(week.sessions.filter((s) => s.distanceKm > 0)).toHaveLength(5);
    // A second re-plan later in the week moves the line.
    todayDate.value = '2026-11-12';
    excludeDay('2026-11-14');
    expect(state.value!.events[0]).toMatchObject({ days: [0, 1, 2, 4, 6], replanFrom: '2026-11-12' });
  });
});

describe('setAvailability', () => {
  beforeEach(() => {
    resetPlan();
    todayDate.value = '2026-11-06';
    createPlan({ weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6, peakWeeklyKm: 70 }, { date: '2027-03-14', distanceKm: 42.195 });
  });

  it('replaces the override for a week, and records the re-plan date only for the current week', () => {
    setAvailability('2026-11-09', [1, 3, 6]);
    setAvailability('2026-11-09', [1, 3, 5]);
    expect(state.value!.events).toEqual([{ id: expect.any(String), kind: 'availability', weekOf: '2026-11-09', days: [1, 3, 5] }]);
    setAvailability('2026-11-02', [0, 1, 2, 3, 4, 5]);
    expect(state.value!.events[1]).toEqual({ id: expect.any(String), kind: 'availability', weekOf: '2026-11-02', days: [0, 1, 2, 3, 4, 5], replanFrom: '2026-11-06' });
  });
});
