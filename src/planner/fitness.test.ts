import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays } from '@/domain/dates';
import type { LogEntry, PlannerState } from '@/domain/types';
import { estimateFitness, levelResponse, weeklyLoads } from './fitness';

function state(partial: Partial<PlannerState> = {}): PlannerState {
  return {
    version: 2,
    createdAt: '2026-10-05',
    athlete: { weeklyKmRecent: 40, longestRecentRunKm: 15, daysPerWeek: 4, longRunDay: 6, peakWeeklyKm: 70 },
    goal: { date: '2027-03-14', distanceKm: 42.195 },
    events: [],
    log: [],
    prefs: { units: 'km' },
    ...partial,
  };
}

function run(date: string, km: number): LogEntry {
  return { id: `${date}-${km}`, date, distanceKm: km };
}

describe('levelResponse', () => {
  it('is monotone, continuous and bounded', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 3, noNaN: true }), fc.double({ min: 0, max: 0.1, noNaN: true }), (r, d) => {
        expect(levelResponse(r + d)).toBeGreaterThanOrEqual(levelResponse(r) - 1e-9);
        expect(levelResponse(r)).toBeGreaterThanOrEqual(0.7);
        expect(levelResponse(r)).toBeLessThanOrEqual(1.1);
        expect(Math.abs(levelResponse(r + d) - levelResponse(r))).toBeLessThan(0.1);
      }),
    );
  });

  it('matches the documented anchor points', () => {
    expect(levelResponse(0)).toBeCloseTo(0.7);
    expect(levelResponse(0.5)).toBeCloseTo(0.85);
    expect(levelResponse(0.85)).toBeCloseTo(1);
    expect(levelResponse(1)).toBe(1);
    expect(levelResponse(1.05)).toBeCloseTo(1.05);
    expect(levelResponse(2)).toBeCloseTo(1.1);
    expect(levelResponse(Number.NaN)).toBe(1);
  });
});

describe('weeklyLoads', () => {
  it('sums the log into Monday-based weeks and ignores skipped entries', () => {
    const loads = weeklyLoads(
      [run('2026-10-06', 10), run('2026-10-11', 20), { ...run('2026-10-13', 99), skipped: true }, run('2026-10-15', 8)],
      '2026-10-05',
      '2026-10-19',
    );
    expect(loads).toEqual([
      { startDate: '2026-10-05', km: 30, runs: 2, longestKm: 20, expectedKm: 0 },
      { startDate: '2026-10-12', km: 8, runs: 1, longestKm: 8, expectedKm: 0 },
    ]);
  });
});

describe('estimateFitness', () => {
  it('uses the declared values when there is no history', () => {
    const f = estimateFitness(state(), '2026-10-05');
    expect(f).toMatchObject({ levelKm: 40, longRunKm: 15, source: 'declared', history: [] });
  });

  it('keeps the level when the athlete follows the plan', () => {
    const log = [
      run('2026-10-06', 10), run('2026-10-08', 10), run('2026-10-11', 18),
      run('2026-10-13', 10), run('2026-10-15', 10), run('2026-10-18', 19),
    ];
    const f = estimateFitness(state({ log }), '2026-10-19');
    expect(f.levelKm).toBeCloseTo(40, 0);
    expect(f.longRunKm).toBe(19);
    expect(f.source).toBe('log');
    expect(f.history.map((w) => w.expectedKm)).toEqual([40, 40]);
  });

  it('drops the level after a week with no running, then two, and counts layoff weeks', () => {
    const one = estimateFitness(state(), '2026-10-12');
    expect(one.levelKm).toBeCloseTo(28, 0); // 40 * 0.7
    expect(one.layoffWeeks).toBe(1);
    const two = estimateFitness(state(), '2026-10-19');
    expect(two.levelKm).toBeCloseTo(19.6, 0);
    expect(two.layoffWeeks).toBe(2);
    const back = estimateFitness(state({ log: [run('2026-10-20', 10), run('2026-10-22', 10)] }), '2026-10-26');
    expect(back.layoffWeeks).toBe(0);
  });

  it('raises the level by at most 10 % per week when running more than planned', () => {
    const log = [run('2026-10-06', 30), run('2026-10-08', 30), run('2026-10-11', 30)];
    const f = estimateFitness(state({ log }), '2026-10-12');
    expect(f.levelKm).toBeCloseTo(44, 0);
  });

  it('pro-rates a partial baseline week', () => {
    // Plan created on a Thursday; only Thu-Sun count (4/7 of the week).
    const s = state({ createdAt: '2026-10-08', log: [run('2026-10-10', 12), run('2026-10-11', 12)] });
    const f = estimateFitness(s, '2026-10-12');
    // expected = 40 * 4/7 ≈ 22.9; actual 24 → ratio > 1 → level grows slightly.
    expect(f.levelKm).toBeGreaterThanOrEqual(40);
    expect(f.levelKm).toBeLessThan(44.1);
  });

  it('replays from the baseline date rather than the creation date', () => {
    const s = state({ createdAt: '2026-09-07', baselineDate: '2026-10-05', log: [] });
    // Weeks before the baseline are ignored; one empty week since baseline → 0.7.
    expect(estimateFitness(s, '2026-10-12').levelKm).toBeCloseTo(28, 0);
  });

  it('never drops below 70 % of the previous level in one week, for any log', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 30, noNaN: true }), { maxLength: 7 }), (kms) => {
        const log = kms.map((km, i) => run(addDays('2026-10-05', i), km));
        const f = estimateFitness(state({ log }), '2026-10-12');
        expect(f.levelKm).toBeGreaterThanOrEqual(28 - 0.1);
        expect(f.levelKm).toBeLessThanOrEqual(44 + 0.1);
      }),
    );
  });
});
